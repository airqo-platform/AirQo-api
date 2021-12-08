"use strict";
const HTTPStatus = require("http-status");
const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const axios = require("axios");
const { logObject, logElement, logText } = require("./log");
const deleteChannel = require("./delete-channel");
const { transform } = require("node-json-transform");
const constants = require("../config/constants");
const cryptoJS = require("crypto-js");
const generateFilter = require("./generate-filter");
const { utillErrors } = require("./errors");
const jsonify = require("./jsonify");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger("create-device-util");
const qs = require("qs");
const { logger_v2 } = require("../utils/errors");
const QRCode = require("qrcode");
const cleanDeep = require("clean-deep");

const createDevice = {
  doesDeviceExist: async (request) => {
    logText("checking device existence...");
    const responseFromList = await createDevice.list(request);
    logObject("responseFromList", responseFromList);
    if (responseFromList.success === true && responseFromList.data) {
      return true;
    }
    return false;
  },
  generateQR: async (request) => {
    try {
      let { include_site } = request.query;
      let responseFromListDevice = await createDevice.list(request);
      if (responseFromListDevice.success) {
        let deviceBody = responseFromListDevice.data;
        if (!isEmpty(include_site) && include_site === "no") {
          logger.info(`the site details have been removed from the data`);
          delete deviceBody.site;
        }
        logger.info(`deviceBody -- ${deviceBody}`);
        let responseFromQRCode = await QRCode.toDataURL(deviceBody);
        logger.info(`responseFromQRCode -- ${responseFromQRCode}`);
        if (!isEmpty(responseFromQRCode)) {
          return {
            success: true,
            message: "successfully generated the QR Code",
            data: responseFromQRCode,
            status: HTTPStatus.OK,
          };
        }
        return {
          success: false,
          message: "unable to generate the QR code",
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      }

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
    } catch (err) {
      logger.error(`server side error -- ${err.message}`);
      return {
        success: false,
        message: "unable to generate the QR code --server side error",
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
          logger.info(
            `successfully create the device --  ${responseFromCreateDeviceOnPlatform.data}`
          );
          let status = responseFromCreateDeviceOnPlatform.status
            ? responseFromCreateDeviceOnPlatform.status
            : "";
          return {
            success: true,
            message: responseFromCreateDeviceOnPlatform.message,
            data: responseFromCreateDeviceOnPlatform.data,
            status,
          };
        }

        if (responseFromCreateDeviceOnPlatform.success === false) {
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
            let status = responseFromCreateDeviceOnPlatform.status
              ? responseFromCreateDeviceOnPlatform.status
              : "";
            logger.error(
              `creation operation failed -- successfully undid the successfull operations -- ${errors}`
            );
            return {
              success: false,
              message:
                "creation operation failed -- successfully undid the successfull operations",
              errors,
              status,
            };
          }

          if (responseFromDeleteDeviceFromThingspeak.success === false) {
            let errors = responseFromDeleteDeviceFromThingspeak.errors
              ? responseFromDeleteDeviceFromThingspeak.errors
              : "";
            let status = responseFromDeleteDeviceFromThingspeak.status
              ? responseFromDeleteDeviceFromThingspeak.status
              : "";
            logger.error(
              `creation operation failed -- also failed to undo the successfull operations --${errors}`
            );
            return {
              success: false,
              message:
                "creation operation failed -- also failed to undo the successfull operations",
              errors,
              status,
            };
          }
        }
      }

      if (isEmpty(enrichmentDataForDeviceCreation)) {
        let errors = responseFromCreateOnThingspeak.errors
          ? responseFromCreateOnThingspeak.errors
          : "";
        let status = responseFromCreateOnThingspeak.status
          ? responseFromCreateOnThingspeak.status
          : "";
        logger.error(
          `unable to generate enrichment data for the device -- ${errors}`
        );

        return {
          success: false,
          message: "unable to generate enrichment data for the device",
          errors,
          status,
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
          return {
            success: false,
            message: responseFromListDevice.message,
            errors,
          };
        }
        let device_number = responseFromListDevice.data[0].device_number;
        logger.info(`device_number -- ${device_number}`);
        modifiedRequest["query"]["device_number"] = device_number;
      }
      logger.info(`the modifiedRequest -- ${modifiedRequest} `);
      logObject("the UnmodifiedRequest ", request);
      let responseFromUpdateDeviceOnThingspeak = await createDevice.updateOnThingspeak(
        modifiedRequest
      );
      logger.info(
        `responseFromUpdateDeviceOnThingspeak -- ${responseFromUpdateDeviceOnThingspeak}`
      );
      if (responseFromUpdateDeviceOnThingspeak.success === true) {
        let responseFromUpdateDeviceOnPlatform = await createDevice.updateOnPlatform(
          request
        );
        logger.info(
          `responseFromUpdateDeviceOnPlatform -- ${responseFromUpdateDeviceOnPlatform}`
        );
        if (responseFromUpdateDeviceOnPlatform.success === true) {
          let status = responseFromUpdateDeviceOnPlatform.status
            ? responseFromUpdateDeviceOnPlatform.status
            : "";
          return {
            success: true,
            message: responseFromUpdateDeviceOnPlatform.message,
            data: responseFromUpdateDeviceOnPlatform.data,
            status,
          };
        }
        if (responseFromUpdateDeviceOnPlatform.success === false) {
          let errors = responseFromUpdateDeviceOnPlatform.errors
            ? responseFromUpdateDeviceOnPlatform.errors
            : "";
          let status = responseFromUpdateDeviceOnPlatform.status
            ? responseFromUpdateDeviceOnPlatform.status
            : "";
          return {
            success: false,
            message: responseFromUpdateDeviceOnPlatform.message,
            errors,
            status,
          };
        }
      }

      if (responseFromUpdateDeviceOnThingspeak.success === false) {
        let errors = responseFromUpdateDeviceOnThingspeak.errors
          ? responseFromUpdateDeviceOnThingspeak.errors
          : "";
        let status = responseFromUpdateDeviceOnThingspeak.status
          ? responseFromUpdateDeviceOnThingspeak.status
          : "";
        return {
          success: false,
          message: responseFromUpdateDeviceOnThingspeak.message,
          errors,
          status,
        };
      }
    } catch (e) {
      logger.error(`update -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: e.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  encryptKeys: async (request) => {
    try {
      const { id, device_number, name, tenant } = request.query;
      const { body } = request;
      logObject("The request", request);
      let update = body;
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      logElement(
        "is responseFromFilter in util a success?",
        responseFromFilter.success
      );
      logger.info(`the filter ${responseFromFilter.data}`);
      if (responseFromFilter.success === true) {
        logObject("the filter", responseFromFilter.data);
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        logger.error(
          `responseFromFilter.error in create-device util--${responseFromFilter.errors}`
        );
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
        };
      }
      let responseFromEncryptKeys = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).encryptKeys({ filter, update });

      logObject("responseFromEncryptKeys ", responseFromEncryptKeys);

      if (responseFromEncryptKeys.success === true) {
        let status = responseFromEncryptKeys.status
          ? responseFromEncryptKeys.status
          : "";
        return {
          success: true,
          message: responseFromEncryptKeys.message,
          data: responseFromEncryptKeys.data,
          status,
        };
      }

      if (responseFromEncryptKeys.success === false) {
        let errors = responseFromEncryptKeys.errors
          ? responseFromEncryptKeys.errors
          : "";
        let status = responseFromEncryptKeys.status
          ? responseFromEncryptKeys.status
          : "";
        return {
          success: false,
          message: responseFromEncryptKeys.message,
          errors,
          status,
        };
      }
    } catch (error) {
      logger.error(`updateOnPlatform util -- ${error.message}`);
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
      logObject("the UnModifiedRequest ", request);

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
      logger.error(`delete -- ${e.message}`);
      return {
        success: false,
        message: "server error --delete -- create-device util",
        errors: e.message,
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
        logObject("the filter", responseFromFilter.data);
        filter = responseFromFilter.data;
        logger.info(`the filter in list -- ${filter}`);
      }

      if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        let status = responseFromFilter.status ? responseFromFilter.status : "";
        logger.error(`the error from filter in list -- ${errors}`);
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
          status,
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
          : "";
        let status = responseFromListDevice.status
          ? responseFromListDevice.status
          : "";
        logger.error(
          `responseFromListDevice was not a success -- ${responseFromListDevice.message} -- ${errors}`
        );
        return {
          success: false,
          message: responseFromListDevice.message,
          errors,
          status,
        };
      }

      if (responseFromListDevice.success === true) {
        let data = responseFromListDevice.data;
        let status = responseFromListDevice.status
          ? responseFromListDevice.status
          : "";
        logger.info(`responseFromListDevice was a success -- ${data}`);
        return {
          success: true,
          message: responseFromListDevice.message,
          data,
          status,
        };
      }
    } catch (e) {
      logger.error(`error for list devices util -- ${e.message}`);
      return {
        success: false,
        message: "list devices util - server error",
        errors: e.message,
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

      logObject("responseFromRegisterDevice", responseFromRegisterDevice);
      logger.info(
        `the responseFromRegisterDevice --${responseFromRegisterDevice} `
      );

      if (responseFromRegisterDevice.success === true) {
        return {
          success: true,
          data: responseFromRegisterDevice.data,
          message: responseFromRegisterDevice.message,
          status: responseFromRegisterDevice.status,
        };
      }

      if (responseFromRegisterDevice.success === false) {
        let errors = responseFromRegisterDevice.errors
          ? responseFromRegisterDevice.errors
          : "";

        return {
          success: false,
          message: responseFromRegisterDevice.message,
          errors,
          status: responseFromRegisterDevice.status,
        };
      }
    } catch (error) {
      logger.error("server error - createOnPlatform util");
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
      const data = body;
      const map = constants.DEVICE_THINGSPEAK_MAPPINGS;
      const context = constants.THINGSPEAK_FIELD_DESCRIPTIONS;
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
      const response = await axios.post(baseURL, transformedBody);

      if (isEmpty(response)) {
        return {
          success: false,
          message: "unable to create the device on thingspeak",
        };
      }

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
    } catch (error) {
      logger.error(` createOnThingSpeak -- ${error.message}`);
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
      logger.error(`updateOnThingspeak util -- ${error.message}`);
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
      const { id, device_number, name, tenant } = request.query;
      const { body } = request;
      logObject("The request", request);
      let update = body;
      let filter = {};
      let responseFromFilter = generateFilter.devices(request);
      logElement(
        "is responseFromFilter in util a success?",
        responseFromFilter.success
      );
      logger.info(`the filter ${responseFromFilter.data}`);
      if (responseFromFilter.success === true) {
        logObject("the filter", responseFromFilter.data);
        filter = responseFromFilter.data;
      }

      if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        logger.error(
          `responseFromFilter.error in create-device util--${responseFromFilter.errors}`
        );
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

      let responseFromModifyDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).modify({ filter, update, opts });

      logObject("responseFromModifyDevice ", responseFromModifyDevice);

      if (responseFromModifyDevice.success === true) {
        let status = responseFromModifyDevice.status
          ? responseFromModifyDevice.status
          : "";
        return {
          success: true,
          message: responseFromModifyDevice.message,
          data: responseFromModifyDevice.data,
          status,
        };
      }

      if (responseFromModifyDevice.success === false) {
        let errors = responseFromModifyDevice.errors
          ? responseFromModifyDevice.errors
          : "";
        let status = responseFromModifyDevice.status
          ? responseFromModifyDevice.status
          : "";
        return {
          success: false,
          message: responseFromModifyDevice.message,
          errors,
          status,
        };
      }
    } catch (error) {
      logger.error(`updateOnPlatform util -- ${error.message}`);
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
      }
      if (!isEmpty(response.data)) {
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
      logger.error(`deleteOnThingspeak -- ${error.message}`);
      utillErrors.tryCatchErrors(error, "server error - updateOnPlatform util");
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
      }

      if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        let status = responseFromFilter.status ? responseFromFilter.status : "";
        logger.error(
          `responseFromFilter.error in create-device util--${responseFromFilter.errors}`
        );
        return {
          success: false,
          message: responseFromFilter.message,
          errors,
          status,
        };
      }
      let responseFromRemoveDevice = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).remove({ filter });

      logger.info(`responseFromRemoveDevice --- ${responseFromRemoveDevice}`);
      if (responseFromRemoveDevice.success === true) {
        let status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : "";
        return {
          success: true,
          message: responseFromRemoveDevice.message,
          data: responseFromRemoveDevice.data,
          status,
        };
      }

      if (responseFromRemoveDevice.success === false) {
        let errors = responseFromRemoveDevice.errors
          ? responseFromRemoveDevice.errors
          : "";
        let status = responseFromRemoveDevice.status
          ? responseFromRemoveDevice.status
          : "";
        return {
          success: false,
          message: responseFromRemoveDevice.message,
          errors,
          status,
        };
      }
    } catch (error) {
      logger.error(`updateOnPlatform util -- ${error.message}`);
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
    };
  },

  decryptKey: (encryptedKey) => {
    try {
      logText("we are inside the decrypt key");
      let bytes = cryptoJS.AES.decrypt(
        encryptedKey,
        constants.KEY_ENCRYPTION_KEY
      );
      let originalText = bytes.toString(cryptoJS.enc.Utf8);
      let status = HTTPStatus.OK;
      let message = "successfully decrypted the text";
      let isKeyUnknown = isEmpty(originalText);
      logElement("isKeyUnknown", isKeyUnknown);
      if (isKeyUnknown) {
        status = HTTPStatus.NOT_FOUND;
        message = "the provided encrypted key is not recognizable";
      }
      return {
        success: true,
        message,
        data: originalText,
        status,
      };
    } catch (err) {
      logObject("the err", err);
      return {
        success: false,
        message: "unable to decrypt the key",
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
      logger.error(`transform -- ${error.message}`);
      return {
        success: false,
        message: "server error - trasform util",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createDevice;
