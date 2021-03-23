const ComponentSchema = require("../models/Component");
const DeviceSchema = require("../models/Device");
const ComponentTypeSchema = require("../models/ComponentType");
const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const constants = require("../config/constants");
const isEmpty = require("is-empty");
const EventSchema = require("../models/Event");
const axios = require("axios");
const { queryParam, filterOptions } = require("../utils/mappings");
const writeToThingMappings = require("../utils/writeToThingMappings");
const {
  uniqueNamesGenerator,
  NumberDictionary,
} = require("unique-names-generator");
const { getModelByTenant } = require("../utils/multitenancy");
const { getMeasurements } = require("../utils/get-measurements");
const generateFieldValues = require("../utils/generate-fields-values");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const {
  getApiKeys,
  getArrayLength,
  doesDeviceExist,
  doesComponentExist,
  doesComponentTypeExist,
} = require("../utils/does-component-exist");

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
        const isDevicePresent = await doesDeviceExist(
          device,
          tenant.toLowerCase()
        );
        if (isDevicePresent) {
          const transformedMeasurements = await transformMeasurements(
            device,
            measurements
          );
          insertMeasurements(res, tenant, transformedMeasurements);
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
        startTime,
        endTime,
        limit,
        skip,
        key,
      } = req.query;
      const limitInt = parseInt(limit, 0);
      const skipInt = parseInt(skip, 0);
      logText(".......getting values.......");
      if (tenant) {
        getMeasurements(
          res,
          startTime,
          endTime,
          device,
          skipInt,
          limitInt,
          tenant
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
