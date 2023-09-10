"use strict";
const DeviceModel = require("@models/Device");
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
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;

const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createDevice = {
  doesDeviceSearchExist: async (request) => {
    try {
      const { filter, tenant } = request;
      let doesSearchExist = await DeviceModel(tenant).exists(filter);
      logElement(" doesSearchExist", doesSearchExist);
      if (doesSearchExist) {
        return {
          success: true,
          message: "search exists",
          data: doesSearchExist,
        };
      } else if (!doesSearchExist) {
        return {
          success: false,
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
  getDevicesCount: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const count = await DeviceModel(tenant).countDocuments({});
      return {
        success: true,
        message: "retrieved the number of devices",
        status: httpStatus.OK,
        data: count,
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  generateQR: async (request) => {
    try {
      const { include_site } = request.query;
      const responseFromListDevice = await createDevice.list(request);
      logObject("responseFromListDevice", responseFromListDevice);
      if (responseFromListDevice.success === true) {
        const deviceBody = responseFromListDevice.data;
        if (isEmpty(deviceBody)) {
          return {
            success: false,
            message: "device does not exist",
          };
        }
        if (!isEmpty(include_site) && include_site === "no") {
          delete deviceBody[0].site;
        } else if (isEmpty(include_site)) {
          delete deviceBody[0].site;
        }

        const stringifiedJSON = deviceBody[0]
          ? JSON.stringify(deviceBody[0])
          : "";
        const url = await QRCode.toDataURL(stringifiedJSON);
        return {
          success: true,
          message: "successfully generated the QR Code",
          data: url,
          status: httpStatus.OK,
        };
      } else if (responseFromListDevice.success === false) {
        return responseFromListDevice;
      }
    } catch (err) {
      logger.error(`Internal Server Error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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

      if (process.env.NODE_ENV !== "production") {
        return {
          success: false,
          message: "Bad Request",
          errors: {
            message:
              "please utilise SOFT creation when operating in testing environments",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      let responseFromCreateOnThingspeak = await createDevice.createOnThingSpeak(
        request
      );

      // logger.info(
      //   `responseFromCreateOnThingspeak -- ${responseFromCreateOnThingspeak}`
      // );

      let enrichmentDataForDeviceCreation = responseFromCreateOnThingspeak.data
        ? responseFromCreateOnThingspeak.data
        : {};
      // logger.info(
      //   `enrichmentDataForDeviceCreation -- ${enrichmentDataForDeviceCreation}`
      // );

      if (!isEmpty(enrichmentDataForDeviceCreation)) {
        let modifiedRequest = request;
        modifiedRequest["body"] = {
          ...request.body,
          ...enrichmentDataForDeviceCreation,
        };

        let responseFromCreateDeviceOnPlatform = await createDevice.createOnPlatform(
          modifiedRequest
        );
        logObject(
          "responseFromCreateDeviceOnPlatform",
          responseFromCreateDeviceOnPlatform
        );
        if (responseFromCreateDeviceOnPlatform.success === true) {
          return responseFromCreateDeviceOnPlatform;
        } else if (responseFromCreateDeviceOnPlatform.success === false) {
          let deleteRequest = {};
          deleteRequest["query"] = {};
          deleteRequest["query"]["device_number"] =
            enrichmentDataForDeviceCreation.device_number;
          // logger.info(`deleteRequest -- ${deleteRequest}`);
          let responseFromDeleteDeviceFromThingspeak = await createDevice.deleteOnThingspeak(
            deleteRequest
          );

          // logger.info(
          //   ` responseFromDeleteDeviceFromThingspeak -- ${responseFromDeleteDeviceFromThingspeak}`
          // );

          if (responseFromDeleteDeviceFromThingspeak.success === true) {
            let errorsString = responseFromCreateDeviceOnPlatform.errors
              ? JSON.stringify(responseFromCreateDeviceOnPlatform.errors)
              : "";
            try {
              logger.error(
                `creation operation failed -- successfully undid the successfull operations -- ${errorsString}`
              );
            } catch (error) {
              logger.error(`internal server error ${error.message}`);
            }
            return {
              success: false,
              message:
                "creation operation failed -- successfully undid the successfull operations",
              errors: responseFromCreateDeviceOnPlatform.errors
                ? responseFromCreateDeviceOnPlatform.errors
                : { message: "Internal Server Error" },
              status: responseFromCreateDeviceOnPlatform.status
                ? responseFromCreateDeviceOnPlatform.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          } else if (responseFromDeleteDeviceFromThingspeak.success === false) {
            const status = responseFromDeleteDeviceFromThingspeak.status
              ? responseFromDeleteDeviceFromThingspeak.status
              : httpStatus.INTERNAL_SERVER_ERROR;
            try {
              let errorsString = responseFromDeleteDeviceFromThingspeak.errors
                ? JSON.stringify(responseFromDeleteDeviceFromThingspeak.errors)
                : "";
              logger.error(
                `creation operation failed -- also failed to undo the successfull operations --${errorsString}`
              );
            } catch (error) {
              logger.error(`internal server error ${error.message}`);
            }
            return {
              success: false,
              message:
                "creation operation failed -- also failed to undo the successfull operations",
              errors: responseFromDeleteDeviceFromThingspeak.errors
                ? responseFromDeleteDeviceFromThingspeak.errors
                : { message: "Internal Server Error" },
              status,
            };
          }
        }
      } else if (isEmpty(enrichmentDataForDeviceCreation)) {
        try {
          let errorsString = responseFromCreateOnThingspeak.errors
            ? JSON.stringify(responseFromCreateOnThingspeak.errors)
            : "";
          logger.error(
            `unable to generate enrichment data for the device -- ${errorsString}`
          );
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return {
          success: false,
          message: "unable to generate enrichment data for the device",
          errors: responseFromCreateOnThingspeak.errors
            ? responseFromCreateOnThingspeak.errors
            : { message: "Internal Server Error" },
          status: responseFromCreateOnThingspeak.status
            ? responseFromCreateOnThingspeak.status
            : "",
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`create -- ${error.message}`);
      return {
        success: false,
        message: "internal server error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      // logger.info(`in the update util....`);
      if (process.env.NODE_ENV !== "production") {
        return {
          success: false,
          message: "Bad Request",
          errors: {
            message:
              "please utilise SOFT update when operating in testing environments",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }
      let { device_number } = request.query;
      let modifiedRequest = Object.assign({}, request);
      if (isEmpty(device_number)) {
        // logger.info(`the device_number is not present in the update request`);
        let responseFromListDevice = await createDevice.list(request);
        // logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
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
        // logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      // logger.info(`the modifiedRequest -- ${modifiedRequest} `);

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
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
      // logger.info(`the filter ${responseFromFilter.data}`);
      if (responseFromFilter.success === true) {
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success === false) {
        try {
          let errorsString = responseFromFilter.errors
            ? JSON.stringify(responseFromFilter.errors)
            : "";
          logger.error(
            `responseFromFilter.error in create-device util--${errorsString}`
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
      let responseFromEncryptKeys = await DeviceModel(tenant).encryptKeys({
        filter,
        update,
      });

      return responseFromEncryptKeys;
    } catch (error) {
      logger.error(
        `internal server error -- updateOnPlatform util -- ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  delete: async (request) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { device_number } = request.query;
      let modifiedRequest = request;
      if (isEmpty(device_number)) {
        // logger.info(`the device_number is not present`);
        let responseFromListDevice = await createDevice.list(request);
        // logger.info(`responseFromListDevice -- ${responseFromListDevice}`);
        if (responseFromListDevice.success === false) {
          return responseFromListDevice;
        }
        let device_number = responseFromListDevice.data[0].device_number;
        // logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      // logger.info(`the modifiedRequest -- ${modifiedRequest} `);

      let responseFromDeleteDeviceFromThingspeak = await createDevice.deleteOnThingspeak(
        modifiedRequest
      );

      // logger.info(
      //   `responseFromDeleteDeviceFromThingspeak -- ${responseFromDeleteDeviceFromThingspeak}`
      // );
      if (responseFromDeleteDeviceFromThingspeak.success === true) {
        let responseFromDeleteDeviceOnPlatform = await createDevice.deleteOnPlatform(
          modifiedRequest
        );

        // logger.info(
        //   `responseFromDeleteDeviceOnPlatform -- ${responseFromDeleteDeviceOnPlatform}`
        // );

        if (responseFromDeleteDeviceOnPlatform.success === true) {
          return responseFromDeleteDeviceOnPlatform;
        } else if (responseFromDeleteDeviceOnPlatform.success === false) {
          return responseFromDeleteDeviceOnPlatform;
        }
      } else if (responseFromDeleteDeviceFromThingspeak.success === false) {
        return {
          success: false,
          message: responseFromDeleteDeviceFromThingspeak.message,
          errors: responseFromDeleteDeviceFromThingspeak.errors
            ? responseFromDeleteDeviceFromThingspeak.errors
            : { message: "" },
          status: parseInt(
            `${
              responseFromDeleteDeviceFromThingspeak.status
                ? responseFromDeleteDeviceFromThingspeak.status
                : ""
            }`
          ),
        };
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "server error --delete -- create-device util",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      let { tenant, category } = request.query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};
      const responseFromFilter = generateFilter.devices(request);
      if (responseFromFilter.success === true) {
        filter = responseFromFilter.data;
      } else if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      if (!isEmpty(category)) {
        filter.category = category;
      }
      const responseFromListDevice = await DeviceModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListDevice;
    } catch (e) {
      logger.error(`error for list devices util -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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

      const responseFromRegisterDevice = await DeviceModel(tenant).register(
        body
      );
      // logger.info(
      //   `the responseFromRegisterDevice --${responseFromRegisterDevice} `
      // );

      if (responseFromRegisterDevice.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          let deviceDataString = responseFromRegisterDevice.data
            ? JSON.stringify(responseFromRegisterDevice.data)
            : "";
          await kafkaProducer.send({
            topic: constants.DEVICES_TOPIC,
            messages: [
              {
                action: "create",
                value: deviceDataString,
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logObject("error on kafka", error);
        }

        return responseFromRegisterDevice;
      } else if (responseFromRegisterDevice.success === false) {
        return responseFromRegisterDevice;
      }
    } catch (error) {
      logObject("errors in the create on platform", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
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

      // logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await createDevice.transform({
        data,
        map,
        context,
      });
      // logger.info(
      //   `responseFromTransformRequestBody -- ${responseFromTransformRequestBody}`
      // );
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
              status: httpStatus.BAD_GATEWAY,
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
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  updateOnThingspeak: async (request) => {
    try {
      // logger.info(`  updateOnThingspeak's request -- ${request}`);
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
      // logger.info(`the context -- ${context}`);
      const responseFromTransformRequestBody = await createDevice.transform({
        data,
        map,
      });
      // logger.info(
      //   `responseFromTransformRequestBody -- ${responseFromTransformRequestBody}`
      // );
      let transformedBody = responseFromTransformRequestBody.success
        ? responseFromTransformRequestBody.data
        : {};

      // logger.info(`transformedBody -- ${transformedBody}`);

      const response = await axios.put(
        constants.UPDATE_THING(device_number),
        qs.stringify(transformedBody),
        config
      );

      // logger.info(`successfully updated the device on thingspeak`);
      return {
        success: true,
        message: "successfully updated the device on thingspeak",
        data: response.data,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message:
          "corresponding device_number does not exist on external system, consider SOFT update",
        status: httpStatus.NOT_FOUND,
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
      if (responseFromFilter.success === true) {
        filter = responseFromFilter.data;
      } else if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        try {
          let filterString = responseFromFilter.errors
            ? JSON.stringify(responseFromFilter.errors)
            : "";
          logger.error(
            `responseFromFilter.error in create-device util--${filterString}`
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

      const responseFromModifyDevice = await DeviceModel(tenant).modify({
        filter,
        update,
        opts,
      });

      return responseFromModifyDevice;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  deleteOnThingspeak: async (request) => {
    try {
      let device_number = parseInt(request.query.device_number, 10);
      // logger.info(`the device_number -- ${device_number}`);
      let response = await axios
        .delete(`${constants.DELETE_THING_URL(device_number)}`)
        .catch((e) => {
          logger.error(`error.response.data -- ${e.response.data}`);
          logger.error(`error.response.status -- ${e.response.status}`);
          logger.error(`error.response.headers -- ${e.response.headers}`);
          if (e.response) {
            return {
              success: false,
              errors: {
                message:
                  "corresponding device_number does not exist on external system, consider SOFT delete",
                error: e.response.data.error,
              },
              status: e.response.data.status,
              message:
                "corresponding device_number does not exist on external system, consider SOFT delete",
            };
          }
        });

      if (!isEmpty(response.success) && !response.success) {
        // logger.info(`the response from thingspeak -- ${response}`);
        return {
          success: false,
          message: `${response.message}`,
          errors: {
            message: "unable to complete operation",
            error: `${response.error}`,
          },
          status: `${response.status}`,
        };
      } else if (!isEmpty(response.data)) {
        // logger.info(
        //   `successfully deleted the device on thingspeak -- ${response.data}`
        // );
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
      // logger.info(
      //   `the requesting coming into deleteOnPlatform util --${request}`
      // );
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      if (responseFromFilter.success === true) {
        // logger.info(`the filter ${responseFromFilter.data}`);
        filter = responseFromFilter.data;
      } else if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        try {
          let filterString = responseFromFilter.errors
            ? JSON.stringify(responseFromFilter.errors)
            : "";
          logger.error(
            `responseFromFilter.error in create-device util--${filterString}`
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
      const responseFromRemoveDevice = await DeviceModel(tenant).remove({
        filter,
      });

      return responseFromRemoveDevice;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteOnclarity: (request) => {
    return {
      success: false,
      message: "coming soon",
      errors: "not yet integrated with the clarity system",
      status: httpStatus.NOT_IMPLEMENTED,
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
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "unable to decrypt the key",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
          status: httpStatus.NOT_FOUND,
          message: "the provided encrypted key is not recognizable",
          errors: { message: "the provided encrypted key is not recognizable" },
        };
      } else {
        return {
          success: true,
          message: "successfully decrypted the text",
          data: originalText,
          status: httpStatus.OK,
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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

  refresh: async (request) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };

      let modifiedRequest = Object.assign({}, request);

      const responseFromFilter = generateFilter.devices(modifiedRequest);
      const filter = responseFromFilter.data;
      const { tenant } = modifiedRequest.query;
      logObject("the filter being used to filter", filter);

      const responseFromListDevice = await DeviceModel(tenant).list({
        filter,
      });

      if (responseFromListDevice.success === true) {
        let deviceDetails = { ...responseFromListDevice.data[0] };
        modifiedRequest["body"] = deviceDetails;
        delete modifiedRequest.body._id;
        delete modifiedRequest.body.sites;
      } else if (responseFromListDevice.success === false) {
        return responseFromListDevice;
      }

      if (
        !isEmpty(modifiedRequest["body"]["device_codes"]) &&
        modifiedRequest["body"]["device_codes"].length < 7
      ) {
        const deviceCodeValues = ["name_id", "name", "_id", "device_number"];

        for (const deviceCode of deviceCodeValues) {
          modifiedRequest["body"]["device_codes"].push(deviceCode);
          logObject("modifiedRequest is here baby", modifiedRequest);
        }
      }

      delete modifiedRequest["body"]["device_number"];

      const update = modifiedRequest["body"];
      const opts = {};

      const responseFromModifyDevice = await DeviceModel(tenant).modify({
        filter,
        update,
        opts,
      });

      if (responseFromModifyDevice.success === true) {
        return {
          success: true,
          message: "Device Details Successfully Refreshed",
          data: responseFromModifyDevice.data,
        };
      } else if (responseFromModifyDevice.success === false) {
        return responseFromModifyDevice;
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        errors: { message: error.message },
        message: "Internal Server Error",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createDevice;
