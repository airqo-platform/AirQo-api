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
const { transformMeasurements } = require("../utils/transform-measurements");
const insertMeasurements = require("../utils/insert-measurements");
const {
  transmitOneSensorValue,
  transmitMultipleSensorValues,
  bulkTransmitMultipleSensorValues,
} = require("../utils/transmit-values");
const createEventUtil = require("../utils/create-event");

const createEvent = {
  addValues: async (req, res) => {
    try {
      logger.info(`adding values...`);
      const { device, tenant } = req.query;
      const { body } = req;

      let request = {};
      request["query"] = {};
      request["query"]["device"] = device;
      request["query"]["tenant"] = tenant;
      request["body"] = body;

      let responseFromAddEventsUtil = await createEventUtil.addEvents(request);
      logger.info(
        `responseFromAddEventsUtil -- ${JSON.stringify(
          responseFromAddEventsUtil
        )}`
      );

      if (!responseFromAddEventsUtil.success) {
        let errors = responseFromAddEventsUtil.errors
          ? responseFromAddEventsUtil.errors
          : "";
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message: "finished the operation with some errors",
          rejectedCount: responseFromAddEventsUtil.rejectedCount,
          addedCount: responseFromAddEventsUtil.addedCount,
          errors,
          valuesRejected: responseFromAddEventsUtil.valuesRejected,
          valuesAdded: responseFromAddEventsUtil.valuesAdded,
        });
      }

      if (responseFromAddEventsUtil.success) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: "successfully added all the events",
          addedCount: responseFromAddEventsUtil.addedCount,
          valuesAdded: responseFromAddEventsUtil.valuesAdded,
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

      if (tenant) {
        if (!device) {
          res.status(HTTPStatus.BAD_REQUEST).json({
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          });
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
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      logText(`unable to clear device ${device}`);
      tryCatchErrors(res, e);
    }
  },
};

module.exports = createEvent;
