const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const { getMeasurements } = require("../utils/get-measurements");
const log4js = require("log4js");
const logger = log4js.getLogger("create-event-controller");
const {
  tryCatchErrors,
  missingQueryParams,
  badRequest,
} = require("../utils/errors");
const { validationResult } = require("express-validator");
const getDetail = require("../utils/get-device-details");
const isEmpty = require("is-empty");

const { transformMeasurements_v2 } = require("../utils/transform-measurements");
const insertMeasurements = require("../utils/insert-measurements");
const {
  transmitOneSensorValue,
  transmitMultipleSensorValues,
  bulkTransmitMultipleSensorValues,
} = require("../utils/transmit-values");
const createEventUtil = require("../utils/create-event");
const manipulateArraysUtil = require("../utils/manipulate-arrays");

const createEvent = {
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      let request = {};
      logText("the updating game.....");
      request["query"] = req.query;
      let responseFromUpdateEvents = await createEventUtil.update(request);
      if (responseFromUpdateEvents.success === true) {
        const status = responseFromUpdateEvents.status
          ? responseFromUpdateEvents.status
          : "";
        res.status(status).json({
          success: true,
          message: responseFromUpdateEvents.message,
          updated_event: responseFromUpdateEvents.data,
        });
      }
      if (responseFromUpdateEvents.success === false) {
        const status = responseFromUpdateEvents.status
          ? responseFromUpdateEvents.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdateEvents.errors
          ? responseFromUpdateEvents.errors
          : {};
        res.status(status).json({
          success: false,
          message: responseFromUpdateEvents.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      });
    }
  },
  addValues: async (req, res) => {
    try {
      logText("adding values...");
      const { tenant } = req.query;
      const measurements = req.body;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }

      const responseFromTransformMeasurements = await transformMeasurements_v2(
        measurements
      );
      // logObject(
      //   "responseFromTransformMeasurements",
      //   responseFromTransformMeasurements
      // );

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

      // logObject(
      //   "responseFromTransformMeasurements.data",
      //   responseFromTransformMeasurements.data
      // );

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
        device_id,
        site,
        site_id,
        device_number,
        metadata,
        external,
      } = req.query;

      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
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
          device_number,
          device_id,
          site,
          site_id,
          skipInt,
          limitInt,
          frequency,
          tenant,
          startTime,
          endTime,
          metadata,
          external
        );
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
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
  deleteValues: async () => {},
  deleteValuesOnPlatform: async (req, res) => {
    try {
      logText("the delete values operation starts....");
      logger.info(`the delete values operation starts....`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(res, "bad request errors", nestedErrors);
      }
      const { body } = req;
      let request = {};
      request["query"] = { ...req.query, body };
      logger.info(`the request -- ${JSON.stringify(request)}`);
      let responseFromClearValuesOnPlatform = await createEventUtil.clearEventsOnPlatform(
        request
      );
      logger.info(
        `responseFromClearValuesOnPlatform -- ${JSON.stringify(
          responseFromClearValuesOnPlatform
        )}`
      );

      if (responseFromClearValuesOnPlatform.success == false) {
        let error = responseFromClearValuesOnPlatform.error
          ? responseFromClearValuesOnPlatform.error
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromClearValuesOnPlatform.message,
          error,
        });
      }

      if (responseFromClearValuesOnPlatform.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromClearValuesOnPlatform.message,
          data: responseFromClearValuesOnPlatform.data,
        });
      }
    } catch (e) {
      logger.error(`responseFromClearValuesOnPlatform -- ${e.message}`);
      tryCatchErrors(res, e.message, "responseFromClearValuesOnPlatform");
    }
  },
  deleteValuesOnThingspeak: async (req, res) => {
    try {
      const { device, tenant } = req.query;

      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }

      const deviceDetails = await getDetail(tenant, device);
      const doesDeviceExist = !isEmpty(deviceDetails);
      logElement("isDevicePresent ?", doesDeviceExist);
      if (doesDeviceExist) {
        const channelID = await getChannelID(
          req,
          res,
          device,
          tenant.toLowerCase()
        );
        logText("...................................");
        logText("clearing the Thing....");
        logElement("url", constants.CLEAR_THING_URL(channelID));
        await axios
          .delete(constants.CLEAR_THING_URL(channelID))
          .then(async (response) => {
            logText("successfully cleared the device in TS");
            logObject("response from TS", response.data);
            res.status(HTTPStatus.OK).json({
              message: `successfully cleared the data for device ${device}`,
              success: true,
              updatedDevice,
            });
          })
          .catch(function(error) {
            console.log(error);
            res.status(HTTPStatus.BAD_GATEWAY).json({
              message: `unable to clear the device data, device ${device} does not exist`,
              success: false,
            });
          });
      } else {
        logText(`device ${device} does not exist in the system`);
        res.status(HTTPStatus.OK).json({
          message: `device ${device} does not exist in the system`,
          success: false,
        });
      }
    } catch (e) {
      logText(`unable to clear device ${device}`);
      tryCatchErrors(res, e);
    }
  },

  /***********************************************************
   * api_v2 starts
   */
  addEvents: async (req, res) => {
    try {
      logger.info(`adding values...`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      logger.info(`adding values...`);
      const { device, tenant } = req.query;
      const { body } = req;

      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["tenant"] = tenant;
      request["body"] = body;

      let responseFromAddEventsUtil = await createEventUtil.addEvents(request);

      logObject("responseFromAddEventsUtil", responseFromAddEventsUtil);

      logger.info(
        `responseFromAddEventsUtil -- ${JSON.stringify(
          responseFromAddEventsUtil
        )}`
      );

      if (!responseFromAddEventsUtil.success) {
        let errors = responseFromAddEventsUtil.error
          ? responseFromAddEventsUtil.error
          : "";
        return res.status(HTTPStatus.FORBIDDEN).json({
          success: false,
          message: "finished the operation with some errors",
          errors,
        });
      }

      if (responseFromAddEventsUtil.success) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "successfully added all the events",
          stored_events: responseFromAddEventsUtil.data,
        });
      }
    } catch (e) {
      logger.error(`addValue -- ${e.message}`);
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "server error",
        error: e.message,
      });
    }
  },
  viewEvents: async (req, res) => {
    try {
      logger.info(`viewing events...`);
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }

      let responseFromEventsUtil = await createEventUtil.viewEvents(req);
      logObject("responseFromEventsUtil", responseFromEventsUtil);
      logger.info(
        `responseFromEventsUtil -- ${JSON.stringify(responseFromEventsUtil)}`
      );
      if (responseFromEventsUtil.success === true) {
        res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromEventsUtil.message,
          measurements: responseFromEventsUtil.data,
        });
      }

      if (responseFromEventsUtil.success === false) {
        let error = responseFromEventsUtil.error
          ? responseFromEventsUtil.error
          : "";
        res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromEventsUtil.message,
          error,
        });
      }
    } catch (error) {
      logger.error(`viewEvents -- ${error.message}`);
      res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "server error",
        error: error.message,
      });
    }
  },

  /************************************************************
   * api_v2 ends
   */
};

module.exports = createEvent;
