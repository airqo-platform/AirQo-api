const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const { getMeasurements } = require("../utils/get-measurements");

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

const { transformMeasurements } = require("../utils/transform-measurements");
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
      const { device, tenant } = req.query;
      const measurements = req.body;
      if (tenant && device && measurements) {
        const deviceDetails = await getDetail(tenant, device);
        const doesDeviceExist = !isEmpty(deviceDetails);

        if (doesDeviceExist) {
          const transformedMeasurements = await transformMeasurements(
            device,
            measurements
          );
          let response = await insertMeasurements(
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
