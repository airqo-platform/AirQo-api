"use strict";
const HTTPStatus = require("http-status");
module.exports = { getDevicesCount, list, decryptKey };
const DeviceSchema = require("@models/Device");
const { getModelByTenant } = require("@config/database");
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
let devicesModel = (tenant) => {
  return getModelByTenant(tenant, "device", DeviceSchema);
};

async function list(request) {
  try {
    let { tenant } = request.query;
    const limit = parseInt(request.query.limit, 0);
    const skip = parseInt(request.query.skip, 0);
    let filter = {};
    logObject("the request for the filter", request);
    let responseFromFilter = generateFilter.devices(request);
    // logger.info(`responseFromFilter -- ${responseFromFilter}`);

    if (responseFromFilter.success === true) {
      filter = responseFromFilter.data;
      logObject("the filter being used", filter);
      // logger.info(`the filter in list -- ${filter}`);
    } else if (responseFromFilter.success === false) {
      let errors = responseFromFilter.errors
        ? responseFromFilter.errors
        : { message: "" };
      let status = responseFromFilter.status ? responseFromFilter.status : "";
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

    // logger.info(
    //   `the responseFromListDevice in list -- ${responseFromListDevice} `
    // );

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
      return responseFromListDevice;
    } else if (responseFromListDevice.success === true) {
      let data = responseFromListDevice.data;
      // logger.info(`responseFromListDevice was a success -- ${data}`);
      return responseFromListDevice;
    }
  } catch (e) {
    logger.error(`error for list devices util -- ${e.message}`);
    return {
      success: false,
      message: "list devices util - server error",
      errors: { message: e.message },
      status: HTTPStatus.INTERNAL_SERVER_ERROR,
    };
  }
}

async function getDevicesCount(request, callback) {
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
          errors: { message: err.message },
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
}

async function decryptKey(encryptedKey) {
  try {
    let bytes = cryptoJS.AES.decrypt(
      encryptedKey,
      constants.KEY_ENCRYPTION_KEY
    );
    let originalText = bytes.toString(cryptoJS.enc.Utf8);
    let isKeyUnknown = isEmpty(originalText);
    if (isKeyUnknown) {
      return {
        success: true,
        status: HTTPStatus.NOT_FOUND,
        message: "the provided encrypted key is not recognizable",
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
      message: "unable to decrypt the key",
      errors: { message: err.message },
      status: HTTPStatus.INTERNAL_SERVER_ERROR,
    };
  }
}

module.exports = { getDevicesCount, list, decryptKey };
