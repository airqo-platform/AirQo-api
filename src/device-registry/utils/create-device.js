"use strict";
const HTTPStatus = require("http-status");
const DeviceSchema = require("@models/Device");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const { transform } = require("node-json-transform");
const constants = require("@config/constants");
const cryptoJS = require("crypto-js");
const generateFilter = require("./generate-filter");
const errors = require("./errors");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-device-util`
);
const qs = require("qs");
const QRCode = require("qrcode");
const httpStatus = require("http-status");
let devicesModel = (tenant) => {
  return getModelByTenant(tenant, "device", DeviceSchema);
};

const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createDevice = {
  doesDeviceSearchExist: async (request) => {
    try {
      const { filter, tenant } = request;
      let doesSearchExist = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).exists(filter);
      logElement(" doesSearchExist", doesSearchExist);
      if (!isEmpty(doesSearchExist)) {
        return {
          success: true,
          message: "search exists",
          data: doesSearchExist,
        };
      } else if (isEmpty(doesSearchExist)) {
        return {
          success: true,
          message: "search does not exist",
          data: [],
        };
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  doesDeviceExist: async (request) => {
    logText("checking device existence...");
    const responseFromList = await createDevice.list(request);
    if (responseFromList.success === true && responseFromList.data) {
      return true;
    }
    return false;
  },
  getDevicesCount: async (request, callback) => {
    try {
      const { query } = request;
      const { tenant } = query;
      await devicesModel(tenant).countDocuments({}, (err, count) => {
        if (count) {
          callback({
            success: true,
            message: "retrieved the number of devices",
            status: HTTPStatus.OK,
            data: count,
          });
        }
        if (err) {
          callback({
            success: false,
            message: "Internal Server Error",
            errors: { message: err },
            status: HTTPStatus.INTERNAL_SERVER_ERROR,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  generateQR: async (request) => {
    try {
      let { include_site } = request.query;
      let responseFromListDevice = await createDevice.list(request);
      if (responseFromListDevice.success) {
        let deviceBody = responseFromListDevice.data;
        if (isEmpty(deviceBody)) {
          return {
            success: false,
            message: "device does not exist",
          };
        }
        if (!isEmpty(include_site) && include_site === "no") {
          logger.info(`the site details have been removed from the data`);
          delete deviceBody[0].site;
        }
        if (isEmpty(include_site)) {
          delete deviceBody[0].site;
        }
        logger.info(`deviceBody -- ${deviceBody}`);
        const stringifiedJSON = JSON.stringify(deviceBody[0]);
        let responseFromQRCode = await QRCode.toDataURL(stringifiedJSON, {
          type: String,
        });
        logger.info(`responseFromQRCode -- ${responseFromQRCode}`);
        if (!isEmpty(responseFromQRCode)) {
          return {
            success: true,
            message: "successfully generated the QR Code",
            data: responseFromQRCode,
            status: HTTPStatus.OK,
          };
        } else if (isEmpty(responseFromQRCode)) {
          logObject("responseFromQRCode", responseFromQRCode);
          return {
            success: true,
            message: "unable to generate the QR code",
            status: HTTPStatus.ACCEPTED,
          };
        }
      } else if (responseFromListDevice.success === false) {
        return responseFromListDevice;
      }
    } catch (err) {
      logger.error(`Internal Server Error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (request) => {
    try {
      if (request.query.tenant !== "airqo") {
        return {
          success: false,
          message: "creation is not yet possible for this organisation",
          status: httpStatus.NOT_IMPLEMENTED,
        };
      }
      let responseFromCreateOnThingspeak = await createDevice.createOnThingSpeak(
        request
      );

      logger.info(
        `responseFromCreateOnThingspeak -- ${responseFromCreateOnThingspeak}`
      );

      let enrichmentDataForDeviceCreation = responseFromCreateOnThingspeak.data
        ? responseFromCreateOnThingspeak.data
        : {};
      logger.info(
        `enrichmentDataForDeviceCreation -- ${enrichmentDataForDeviceCreation}`
      );

      if (!isEmpty(enrichmentDataForDeviceCreation)) {
        let modifiedRequest = request;
        modifiedRequest["body"] = {
          ...request.body,
          ...enrichmentDataForDeviceCreation,
        };

        let responseFromCreateDeviceOnPlatform = await createDevice.createOnPlatform(
          modifiedRequest
        );

        if (responseFromCreateDeviceOnPlatform.success === true) {
          return responseFromCreateDeviceOnPlatform;
        } else if (responseFromCreateDeviceOnPlatform.success === false) {
          let deleteRequest = {};
          deleteRequest["query"] = {};
          deleteRequest["query"]["device_number"] =
            enrichmentDataForDeviceCreation.device_number;
          logger.info(`deleteRequest -- ${deleteRequest}`);
          let responseFromDeleteDeviceFromThingspeak = await createDevice.deleteOnThingspeak(
            deleteRequest
          );

          logger.info(
            ` responseFromDeleteDeviceFromThingspeak -- ${responseFromDeleteDeviceFromThingspeak}`
          );

          if (responseFromDeleteDeviceFromThingspeak.success === true) {
            let errors = responseFromCreateDeviceOnPlatform.errors
              ? responseFromCreateDeviceOnPlatform.errors
              : "";
            try {
              logger.error(
                `creation operation failed -- successfully undid the successfull operations -- ${JSON.stringify(
                  errors
                )}`
              );
            } catch (error) {
              logger.error(`internal server error ${error.message}`);
            }
            return {
              success: false,
              message:
                "creation operation failed -- successfully undid the successfull operations",
              errors,
              status: responseFromCreateDeviceOnPlatform.status
                ? responseFromCreateDeviceOnPlatform.status
                : "",
            };
          } else if (responseFromDeleteDeviceFromThingspeak.success === false) {
            let errors = responseFromDeleteDeviceFromThingspeak.errors
              ? responseFromDeleteDeviceFromThingspeak.errors
              : "";
            let status = responseFromDeleteDeviceFromThingspeak.status
              ? responseFromDeleteDeviceFromThingspeak.status
              : "";
            try {
              logger.error(
                `creation operation failed -- also failed to undo the successfull operations --${JSON.stringify(
                  errors
                )}`
              );
            } catch (error) {
              logger.error(`internal server error ${error.message}`);
            }
            return {
              success: false,
              message:
                "creation operation failed -- also failed to undo the successfull operations",
              errors,
              status,
            };
          }
        }
      } else if (isEmpty(enrichmentDataForDeviceCreation)) {
        let errors = responseFromCreateOnThingspeak.errors
          ? responseFromCreateOnThingspeak.errors
          : "";
        try {
          logger.error(
            `unable to generate enrichment data for the device -- ${JSON.stringify(
              errors
            )}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return {
          success: false,
          message: "unable to generate enrichment data for the device",
          errors,
          status: responseFromCreateOnThingspeak.status
            ? responseFromCreateOnThingspeak.status
            : "",
        };
      }
    } catch (error) {
      logger.error(`create -- ${error.message}`);
      return {
        success: false,
        message: "server error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      logger.info(`in the update util....`);
      let { device_number } = request.query;
      let modifiedRequest = Object.assign({}, request);
      if (isEmpty(device_number)) {
        logger.info(`the device_number is not present in the update request`);
        let responseFromListDevice = await createDevice.list(request);
        logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
        if (responseFromListDevice.success === false) {
          return {
            success: false,
            message: responseFromListDevice.message,
            errors: responseFromListDevice.errors
              ? responseFromListDevice.errors
              : { message: "" },
          };
        }
        device_number = responseFromListDevice.data[0].device_number;
        logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      logger.info(`the modifiedRequest -- ${modifiedRequest} `);

      if (isEmpty(device_number)) {
        const responseFromUpdateDeviceOnPlatform = await createDevice.updateOnPlatform(
          request
        );
        return responseFromUpdateDeviceOnPlatform;
      } else if (!isEmpty(device_number)) {
        const responseFromUpdateDeviceOnThingspeak = await createDevice.updateOnThingspeak(
          modifiedRequest
        );
        if (responseFromUpdateDeviceOnThingspeak.success === true) {
          const responseFromUpdateDeviceOnPlatform = await createDevice.updateOnPlatform(
            request
          );
          return responseFromUpdateDeviceOnPlatform;
        } else if (responseFromUpdateDeviceOnThingspeak.success === false) {
          return responseFromUpdateDeviceOnThingspeak;
        }
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  encryptKeys: async (request) => {
    try {
      const { id, device_number, name, tenant } = request.query;
      const { body } = request;
      let update = body;
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      logElement(
        "is responseFromFilter in util a success?",
        responseFromFilter.success
      );
      logger.info(`the filter ${responseFromFilter.data}`);
      if (responseFromFilter.success === true) {
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success === false) {
        try {
          logger.error(
            `responseFromFilter.error in create-device util--${JSON.stringify(
              responseFromFilter.errors
            )}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
        return {
          success: false,
          message: responseFromFilter.message,
          errors: responseFromFilter.errors
            ? responseFromFilter.errors
            : { message: "" },
        };
      }
      let responseFromEncryptKeys = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).encryptKeys({ filter, update });

      return responseFromEncryptKeys;
    } catch (error) {
      logger.error(
        `internal server error -- updateOnPlatform util -- ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  delete: async (request) => {
    try {
      return {
        success: false,
        message: "feature temporarity disabled --coming soon",
        status: HTTPStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { device_number } = request.query;
      let modifiedRequest = request;
      if (isEmpty(device_number)) {
        logger.info(`the device_number is not present`);
        let responseFromListDevice = await createDevice.list(request);
        logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
        if (responseFromListDevice.success === false) {
          let errors = responseFromListDevice.errors
            ? responseFromListDevice.errors
            : "";
          let status = responseFromListDevice.status
            ? responseFromListDevice.status
            : "";
          return {
            success: false,
            message: responseFromListDevice.message,
            errors,
            status,
          };
        }
        let device_number = responseFromListDevice.data[0].device_number;
        logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      logger.info(`the modifiedRequest -- ${modifiedRequest} `);

      let responseFromDeleteDeviceFromThingspeak = await createDevice.deleteOnThingspeak(
        modifiedRequest
      );

      logger.info(
        `responseFromDeleteDeviceFromThingspeak -- ${responseFromDeleteDeviceFromThingspeak}`
      );
      if (responseFromDeleteDeviceFromThingspeak.success === true) {
        let responseFromDeleteDeviceOnPlatform = await createDevice.deleteOnPlatform(
          modifiedRequest
        );

        logger.info(
          `responseFromDeleteDeviceOnPlatform -- ${responseFromDeleteDeviceOnPlatform}`
        );

        if (responseFromDeleteDeviceOnPlatform.success === true) {
          let status = responseFromDeleteDeviceOnPlatform.status
            ? responseFromDeleteDeviceOnPlatform.status
            : "";
          return {
            success: true,
            message: responseFromDeleteDeviceOnPlatform.message,
            data: responseFromDeleteDeviceOnPlatform.data,
            status,
          };
        }

        if (responseFromDeleteDeviceOnPlatform.success === false) {
          let errors = responseFromDeleteDeviceOnPlatform.errors
            ? responseFromDeleteDeviceOnPlatform.errors
            : "";
          let status = responseFromDeleteDeviceOnPlatform.status
            ? responseFromDeleteDeviceOnPlatform.status
            : "";
          return {
            success: false,
            message: responseFromDeleteDeviceOnPlatform.message,
            errors,
            status,
          };
        }
      }

      if (responseFromDeleteDeviceFromThingspeak.success === false) {
        let errors = responseFromDeleteDeviceFromThingspeak.errors
          ? responseFromDeleteDeviceFromThingspeak.errors
          : "";
        let status = parseInt(
          `${
            responseFromDeleteDeviceFromThingspeak.status
              ? responseFromDeleteDeviceFromThingspeak.status
              : ""
          }`
        );
        return {
          success: false,
          message: responseFromDeleteDeviceFromThingspeak.message,
          errors,
          status,
        };
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "server error --delete -- create-device util",
        errors: { message: e.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      let { tenant } = request.query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      logger.info(`responseFromFilter -- ${responseFromFilter}`);

      if (responseFromFilter.success === true) {
        filter = responseFromFilter.data;
        logger.info(`the filter in list -- ${filter}`);
      } else if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        try {
          logger.error(
            `the error from filter in list -- ${JSON.stringify(errors)}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
          status: responseFromFilter.status ? responseFromFilter.status : "",
        };
      }

      let responseFromListDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).list({
        filter,
        limit,
        skip,
      });

      logger.info(
        `the responseFromListDevice in list -- ${responseFromListDevice} `
      );

      if (responseFromListDevice.success === false) {
        let errors = responseFromListDevice.errors
          ? responseFromListDevice.errors
          : { message: "" };
        try {
          logger.error(
            `responseFromListDevice was not a success -- ${
              responseFromListDevice.message
            } -- ${JSON.stringify(errors)}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
        return {
          success: false,
          message: responseFromListDevice.message,
          errors,
          status: responseFromListDevice.status
            ? responseFromListDevice.status
            : "",
        };
      } else if (responseFromListDevice.success === true) {
        return responseFromListDevice;
      }
    } catch (e) {
      logger.error(`error for list devices util -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  clear: (request) => {
    return {
      success: false,
      message: "coming soon...",
    };
  },

  createOnClarity: (request) => {
    return {
      message: "coming soon",
      success: false,
    };
  },

  createOnPlatform: async (request) => {
    try {
      logText("createOnPlatform util....");
      const { tenant } = request.query;
      const { body } = request;

      const responseFromRegisterDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).register(body);
      logger.info(
        `the responseFromRegisterDevice --${responseFromRegisterDevice} `
      );

      if (responseFromRegisterDevice.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.DEVICES_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterDevice.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logObject("error on kafka", error);
        }

        return responseFromRegisterDevice;
      }

      if (responseFromRegisterDevice.success === false) {
        return responseFromRegisterDevice;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  createOnThingSpeak: async (request) => {
    try {
      const baseURL = constants.CREATE_THING_URL;
      const { body } = request;
      const { category } = body;
      let data = body;
      if (isEmpty(data.long_name) && !isEmpty(data.name)) {
        data.long_name = data.name;
      }
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      let context = {};
      if (category === "bam") {
        context = constants.BAM_THINGSPEAK_FIELD_DESCRIPTIONS;
      } else {
        context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      }

      logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await createDevice.transform({
        data,
        map,
        context,
      });
      logger.info(
        `responseFromTransformRequestBody -- ${responseFromTransformRequestBody}`
      );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      if (isEmpty(transformedBody)) {
        return {
          success: false,
          message: responseFromTransformRequestBody.message,
        };
      }
      return await axios
        .post(baseURL, transformedBody)
        .then((response) => {
          let writeKey = response.data.api_keys[0].write_flag
            ? response.data.api_keys[0].api_key
            : "";
          let readKey = !response.data.api_keys[1].write_flag
            ? response.data.api_keys[1].api_key
            : "";

          let newChannel = {
            device_number: `${response.data.id}`,
            writeKey: writeKey,
            readKey: readKey,
          };

          return {
            success: true,
            message: "successfully created the device on thingspeak",
            data: newChannel,
          };
        })
        .catch((error) => {
          if (error.response) {
            return {
              success: false,
              status: error.response.status
                ? error.response.status
                : parseInt(error.response.data.status),
              errors: {
                message: error.response.statusText
                  ? error.response.statusText
                  : error.response.data.error,
              },
            };
          } else {
            return {
              success: false,
              message: "Bad Gateway Error",
              status: HTTPStatus.BAD_GATEWAY,
              errors: {
                message:
                  "unable to create the device on thingspeak, crosscheck why",
              },
            };
          }
        });
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  updateOnThingspeak: async (request) => {
    try {
      logger.info(`  updateOnThingspeak's request -- ${request}`);
      const { device_number } = request.query;
      logElement("device_number", device_number);
      const { body } = request;
      const config = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };
      const data = body;
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      const context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
      logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await createDevice.transform({
        data,
        map,
      });
      logger.info(
        `responseFromTransformRequestBody -- ${responseFromTransformRequestBody}`
      );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      logger.info(`transformedBody -- ${transformedBody}`);

      const response = await axios.put(
        constants.UPDATE_THING(device_number),
        qs.stringify(transformedBody),
        config
      );

      logger.info(`successfully updated the device on thingspeak`);
      return {
        success: true,
        message: "successfully updated the device on thingspeak",
        data: response.data,
        status: HTTPStatus.OK,
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message:
          "corresponding device_number does not exist on external system, consider SOFT update",
        status: HTTPStatus.NOT_FOUND,
        errors: { message: error.message },
      };
    }
  },
  updateOnClarity: (request) => {
    return {
      success: false,
      message: "coming soon...",
      errors: "not yet integrated with the clarity system",
    };
  },
  updateOnPlatform: async (request) => {
    try {
      const { tenant } = request.query;
      const { body } = request;
      let update = body;
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      logElement(
        "is responseFromFilter in util a success?",
        responseFromFilter.success
      );
      logger.info(`the filter ${responseFromFilter.data}`);
      if (responseFromFilter.success === true) {
        filter = responseFromFilter.data;
      } else if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        try {
          logger.error(
            `responseFromFilter.error in create-device util--${JSON.stringify(
              responseFromFilter.errors
            )}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
        };
      }
      let opts = {};
      update["$addToSet"] = {};
      update["$addToSet"]["pictures"] = update.pictures;
      delete update.pictures;
      if (isEmpty(update["$addToSet"]["pictures"])) {
        delete update.$addToSet;
      }

      let responseFromModifyDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).modify({ filter, update, opts });

      return responseFromModifyDevice;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  deleteOnThingspeak: async (request) => {
    try {
      let device_number = parseInt(request.query.device_number, 10);
      logger.info(`the device_number -- ${device_number}`);
      let response = await axios
        .delete(`${constants.DELETE_THING_URL(device_number)}`)
        .catch((e) => {
          logger.error(`error.response.data -- ${e.response.data}`);
          logger.error(`error.response.status -- ${e.response.status}`);
          logger.error(`error.response.headers -- ${e.response.headers}`);
          if (e.response) {
            let errors = e.response.data.error;
            let status = e.response.data.status;
            return {
              success: false,
              errors,
              status,
              message:
                "corresponding device_number does not exist on external system, consider SOFT delete",
            };
          }
        });

      if (!isEmpty(response.success) && !response.success) {
        logger.info(`the response from thingspeak -- ${response}`);
        return {
          success: false,
          message: `${response.message}`,
          errors: `${response.error}`,
          status: `${response.status}`,
        };
      } else if (!isEmpty(response.data)) {
        logger.info(
          `successfully deleted the device on thingspeak -- ${response.data}`
        );
        return {
          success: true,
          message: "successfully deleted the device on thingspeak",
          data: response.data,
        };
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  deleteOnPlatform: async (request) => {
    try {
      const { tenant } = request.query;
      logger.info(
        `the requesting coming into deleteOnPlatform util --${request}`
      );
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      if (responseFromFilter.success === true) {
        logger.info(`the filter ${responseFromFilter.data}`);
        filter = responseFromFilter.data;
      } else if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        try {
          logger.error(
            `responseFromFilter.error in create-device util--${JSON.stringify(
              responseFromFilter.errors
            )}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
          status: responseFromFilter.status ? responseFromFilter.status : "",
        };
      }
      let responseFromRemoveDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).remove({ filter });

      return responseFromRemoveDevice;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteOnclarity: (request) => {
    return {
      success: false,
      message: "coming soon",
      errors: "not yet integrated with the clarity system",
      status: HTTPStatus.NOT_IMPLEMENTED,
    };
  },

  decryptManyKeys: (encryptedKeys) => {
    try {
      let results = [];
      function helper(helperInput) {
        if (helperInput.length === 0) {
          return;
        }
        const bytes = cryptoJS.AES.decrypt(
          helperInput[0].encrypted_key,
          constants.KEY_ENCRYPTION_KEY
        );
        const originalText = bytes.toString(cryptoJS.enc.Utf8);
        helperInput[0].decrypted_key = originalText;
        results.push(helperInput[0]);
        helper(helperInput.slice(1));
      }
      helper(encryptedKeys);
      return {
        success: true,
        message: "successfully decrypted the provided keys",
        data: results,
        status: HTTPStatus.OK,
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "unable to decrypt the key",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  decryptKey: (encryptedKey) => {
    try {
      let bytes = cryptoJS.AES.decrypt(
        encryptedKey,
        constants.KEY_ENCRYPTION_KEY
      );
      let originalText = bytes.toString(cryptoJS.enc.Utf8);
      let isKeyUnknown = isEmpty(originalText);
      if (isKeyUnknown) {
        return {
          success: false,
          status: HTTPStatus.NOT_FOUND,
          message: "the provided encrypted key is not recognizable",
          errors: { message: "the provided encrypted key is not recognizable" },
        };
      } else {
        return {
          success: true,
          message: "successfully decrypted the text",
          data: originalText,
          status: HTTPStatus.OK,
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  transform: ({ data = {}, map = {}, context = {} } = {}) => {
    try {
      const result = transform(data, map, context);
      if (!isEmpty(result)) {
        return {
          success: true,
          message: "successfully transformed the json request",
          data: result,
        };
      } else {
        logger.warn(
          `the request body for the external system is empty after transformation`
        );
        return {
          success: true,
          message:
            "the request body for the external system is empty after transformation",
          data: result,
        };
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createDevice;
