const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const constants = require("../config/constants");
const axios = require("axios");
const writeToThingMappings = require("../utils/writeToThingMappings");
const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");
const httpStatus = require("http-status");

const createRequestBody = require("../utils/create-request-body");

const getDetail = require("../utils/get-device-details");

const {
  transformMeasurements,
  transformMeasurementFields,
} = require("./transform-measurements");

const transmitOneSensorValue = async (req, res) => {
  try {
    const { quantity_kind, value } = req.body;
    const { tenant } = req.query;
    const deviceDetail = await getDetail(req, res);
    const api_key = deviceDetail[0]._doc.writeKey;

    if (tenant && quantity_kind && value) {
      await axios
        .get(
          constants.ADD_VALUE(
            writeToThingMappings(quantity_kind),
            value,
            api_key
          )
        )
        .then(function(response) {
          let resp = {};
          resp.channel_id = response.data.channel_id;
          resp.created_at = response.data.created_at;
          resp.entry_id = response.data.entry_id;
          res.status(httpStatus.OK).json({
            message: "successfully transmitted the data",
            success: true,
            data: resp,
          });
        })
        .catch(function(error) {
          axiosError(error, req, res);
        });
    } else {
      missingQueryParams(req, res);
    }
  } catch (e) {
    tryCatchErrors(res, error);
  }
};

const transmitMultipleSensorValues = async (req, res) => {
  try {
    logText("write to thing json.......");
    let { tenant } = req.query;
    const requestBody = createRequestBody(req);
    const deviceDetail = await getDetail(req, res);
    const api_key = deviceDetail[0]._doc.writeKey;
    requestBody.api_key = api_key;

    if (tenant) {
      await axios
        .post(constants.ADD_VALUE_JSON, requestBody)
        .then(function(response) {
          let resp = {};
          resp.channel_id = response.data.channel_id;
          resp.created_at = response.data.created_at;
          resp.entry_id = response.data.entry_id;
          res.status(HTTPStatus.OK).json({
            message: "successfully transmitted the data",
            success: true,
            update: resp,
          });
        })
        .catch(function(error) {
          logElement("the error", error.message);
          axiosError(error, req, res);
        });
    } else {
      missingQueryParams(req, res);
    }
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

const bulkTransmitMultipleSensorValues = async (req, res) => {
  try {
    logText("bulk write to thing.......");
    let { tenant, type } = req.query;
    let { updates } = req.body;
    const deviceDetail = await getDetail(req, res);
    const channel = deviceDetail[0]._doc.channelID;
    const api_key = deviceDetail[0]._doc.writeKey;
    if (updates && tenant && type) {
      let transformedUpdates = await transformMeasurementFields(updates);
      let requestObject = {};
      requestObject.write_api_key = api_key;
      requestObject.updates = transformedUpdates;
      await axios
        .post(constants.BULK_ADD_VALUES_JSON(channel), requestObject)
        .then(function(response) {
          console.log(response.data);
          let output = response.data;
          res.status(HTTPStatus.OK).json({
            message: "successfully transmitted the data",
            success: true,
            data: output,
          });
        })
        .catch(function(error) {
          axiosError(error, req, res);
        });
    } else {
      missingQueryParams(req, res);
    }
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

module.exports = {
  transmitOneSensorValue,
  transmitMultipleSensorValues,
  bulkTransmitMultipleSensorValues,
};
