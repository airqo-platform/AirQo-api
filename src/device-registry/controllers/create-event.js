const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const { getMeasurements } = require("../utils/get-measurements");
<<<<<<< HEAD
=======
// const insertMeasurementsService = require("../services/insert-device-measurements");
>>>>>>> staging

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
  invalidParamsValue,
  badRequest,
} = require("../utils/errors");

const getDetail = require("../utils/get-device-details");

const isEmpty = require("is-empty");

const { transformMeasurements_v2 } = require("../utils/transform-measurements");
const insertMeasurements = require("../utils/insert-measurements");
const {
  transmitOneSensorValue,
  transmitMultipleSensorValues,
  bulkTransmitMultipleSensorValues,
} = require("../utils/transmit-values");

const createEvent = {
  addValues: async (req, res) => {
    try {
      logText("adding values...");
      const { tenant } = req.query;
      const measurements = req.body;
      let errors = [];
      if (!Array.isArray(measurements)) {
        errors.push({
          location: "body",
          value_type: typeof measurements,
          msg: "the the input body should be an array, please crosscheck ",
        });
      }
      if (!tenant) {
        errors.push({
          location: "query",
          value: "",
          param: "tenant",
          msg: "the tenant query parameter must be provided ",
        });
      }

      if (errors.length > 0) {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "bad request errors",
          errors,
        });
      }

      const responseFromTransformMeasurements = await transformMeasurements_v2(
        measurements
      );
      logObject(
        "responseFromTransformMeasurements",
        responseFromTransformMeasurements
      );

      if (!responseFromTransformMeasurements.success) {
        let error = responseFromTransformMeasurements.error
          ? responseFromTransformMeasurements.error
          : "";
        res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromTransformMeasurements.message,
          error,
        });
      }

      logObject(
        "responseFromTransformMeasurements.data",
        responseFromTransformMeasurements.data
      );

      let response = await insertMeasurements(
        tenant,
        responseFromTransformMeasurements.data
      );

      if (!response.success) {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "finished the operation with some errors",
          errors: response.errors,
        });
      } else {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "successfully added all the events",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "server side error , create events - controller",
        error: e.message,
      });
    }
  },
  getValues: (req, res) => {
    try {
      const {
        device,
        tenant,
        limit,
        skip,
        key,
        recent,
        frequency,
        startTime,
        endTime,
      } = req.query;
      if (Array.isArray(req.query.device)) {
        return badRequest(
          res,
          "multiple Device query params not supported, please use one comma separated one",
          []
        );
      }
      const limitInt = parseInt(limit, 0);
      const skipInt = parseInt(skip, 0);
      logText(".......getting values.......");
      if (tenant) {
        getMeasurements(
          res,
          recent,
          device,
          skipInt,
          limitInt,
          frequency,
          tenant,
          startTime,
          endTime
        );
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  /********************************* trasmit values from device *******************************/
  transmitValues: async (req, res) => {
    try {
      const { type, tenant } = req.query;
      if (type == "one" && tenant) {
        await transmitOneSensorValue(req, res);
      } else if (type == "many" && tenant) {
        await transmitMultipleSensorValues(req, res);
      } else if (type == "bulk" && tenant) {
        await bulkTransmitMultipleSensorValues(req, res, tenant);
      } else {
        missingQueryParams(req, res);
      }
    } catch (error) {
      tryCatchErrors(res, error);
    }
  },
};

module.exports = createEvent;
