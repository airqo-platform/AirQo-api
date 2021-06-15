const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const { getDeviceDetailsOnPlatform } = require("../utils/get-device-details");
const { getMeasurements } = require("../utils/get-measurements");
const insertMeasurementsService = require("../services/insert-device-measurements");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
  invalidParamsValue,
} = require("../utils/errors");

const isEmpty = require("is-empty");
const {
  createEventsOnPlatform,
  createOneSensorEventOnThingSpeak,
  createDeviceEventsOnThingSpeak,
  createMultipleDeviceEventsOnThingSpeak,
} = require("../utils/create-event");

const { transformMeasurements } = require("../utils/update-event");
const { getMeasurements } = require("../utils/get-event-details");

const createEvent = {
  createEvents: async (req, res) => {
    try {
      logText("adding values...");
      const { device, tenant } = req.query;
      const measurements = req.body;
      if (tenant && device && measurements) {
        const deviceDetails = await getDeviceDetailsOnPlatform(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);

        if (doesDeviceExist) {
          const transformedMeasurements = await transformMeasurements(
            device,
            measurements
          );
          let response = await createEventsOnPlatform(
            tenant,
            transformedMeasurements
          );
          if (response.success == true) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "successfully added all the events",
              valuesAdded: response.valuesAdded,
            });
          } else if (response.success == false) {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: "finished the operation with some errors",
              errors: response.errors,
              valuesRejected: response.valuesRejected,
              valuesAdded: response.valuesAdded,
            });
          }
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `the device (${device}) does not exist on the network`,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, error);
    }
  },
  getEvents: (req, res) => {
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
  transmitEvents: async (req, res) => {
    try {
      const { type, tenant } = req.query;
      if (type == "one" && tenant) {
        await createOneSensorEventOnThingSpeak(req, res);
      } else if (type == "many" && tenant) {
        await createDeviceEventsOnThingSpeak(req, res);
      } else if (type == "bulk" && tenant) {
        await createMultipleDeviceEventsOnThingSpeak(req, res, tenant);
      } else {
        missingQueryParams(req, res);
      }
    } catch (error) {
      tryCatchErrors(res, error);
    }
  },

  clearEvents: async (req, res) => {},
};

module.exports = createEvent;
