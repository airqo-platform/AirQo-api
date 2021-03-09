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
const { getMeasurements } = require("utils/get-measurements");

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

const transformMeasurements = require("../utils/transform-measurements");
const insertMeasurements = require("../utils/insert-measurements");

const createEvent = {
  addValue: async (req, res) => {
    try {
      logText("add value.......");
      let { device, comp, tenant } = req.query;
      let {
        firstPM2_5,
        firstPM10,
        secondPM2_5,
        secondPM10,
        hum,
        volt,
        temp,
        no2,
        so3,
      } = req.body;

      let fields = [
        ...(!isEmpty(firstPM2_5) && "field1"),
        ...(!isEmpty(firstPM10) && "field2"),
        ...(!isEmpty(secondPM2_5) && "field3"),
        ...(!isEmpty(secondPM10) && "field4"),
        ...(!isEmpty(hum) && "field5"),
        ...(!isEmpty(volt) && "field6"),
        ...(!isEmpty(temp) && "field7"),
        ...(!isEmpty(no2) && "field8"),
        ...(!isEmpty(so3) && "field9"),
      ];

      let value = [
        ...(!isEmpty(firstPM2_5) && firstPM2_5),
        ...(!isEmpty(firstPM10) && firstPM10),
        ...(!isEmpty(secondPM2_5) && secondPM2_5),
        ...(!isEmpty(secondPM10) && secondPM10),
        ...(!isEmpty(hum) && hum),
        ...(!isEmpty(volt) && volt),
        ...(!isEmpty(temp) && temp),
        ...(!isEmpty(no2) && no2),
        ...(!isEmpty(so3) && so3),
      ];

      let { writeKey, readKey } = getApiKeys(device, tenant.toLowerCase());
      if (device && comp) {
        const url = constants.ADD_VALUE(fields[0], value[0], writeKey);
        let eventBody = {
          deviceID: device,
          sensorID: comp,
          $addToSet: { values: { $each: value } },
        };
        const event = await getModelByTenant(
          tenant.toLowerCase(),
          "event",
          EventSchema
        ).createEvent(eventBody);
        logObject("DB addition response for add one value", event);
        event
          .then(async (event) => {
            logObject("the added event", event);
            await axios
              .post(url)
              .then(async (response) => {
                logObject("the response", response.data);
                let createdEvent = response.data;
                return res.status(HTTPStatus.CREATED).json({
                  success: true,
                  message: "successfully added the events",
                  createdEvent,
                });
              })
              .catch((e) => {
                let errors = e.message;
                res.status(400).json({
                  success: false,
                  message:
                    "unable to add a value, please crosscheck the validity of all your input values",
                  errors,
                });
              });
          })
          .catch((e) => {
            let errors = e.message;
            res.status(400).json({
              success: false,
              message: "unable to add the events",
              errors: e,
            });
          });
      } else {
        logText("Component and/or device ID are missing in the request query");
      }
    } catch (e) {
      res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ e, message: "unable to add the value", success: false });
    }
  },

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
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "required fields missing either in request body or URL query parameter",
        });
      }
    } catch (e) {
      res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        error: e.message,
        message: "unable to add the values",
      });
    }
  },

  addBulk: async (req, res) => {
    try {
      logText("adding values in bulk...");
      const { device, tenant } = req.query;
      const { values, time } = req.body;
      // logObject("the type of device name", typeof device);
      if (!isEmpty(time) && !isEmpty(device) && !isEmpty(tenant)) {
        const isDevicePresent = await doesDeviceExist(
          device,
          tenant.toLowerCase()
        );
        // logElement("does device exist", isDevicePresent);
        if (isDevicePresent) {
          const day = generateDateFormatWithoutHrs(time);
          const eventBody = {
            device: device,
            day: day,
            nValues: { $lt: constants.N_VALUES },
          };

          let valuesForExistingSensors = values.filter(async function(el) {
            let isComponentPresent = await doesComponentExist(
              el.sensor,
              device,
              tenant.toLowerCase()
            );
            if (isComponentPresent) {
              return true;
            } else {
              return false;
            }
          });

          const options = {
            $push: { values: valuesForExistingSensors },
            $min: { first: time },
            $max: { last: time },
            $inc: { nValues: valuesForExistingSensors.length },
          };

          const addedEvent = await getModelByTenant(
            tenant.toLowerCase(),
            "event",
            EventSchema
          ).updateMany(eventBody, options, {
            upsert: true,
          });

          logObject("the inserted documents", addedEvent);

          if (addedEvent) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "successfully added the device data",
              values: valuesForExistingSensors,
              device: device,
            });
          } else if (!addedEvent) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              message: "unable to add events in bulk",
              success: false,
            });
          } else {
            logText("just unable to add events in bulk");
          }
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `the device (${device}) does not exist on the network`,
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "required fields missing either in request body or URL query parameter",
        });
      }
    } catch (e) {
      res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        error: e.message,
        message: "unable to add the values",
      });
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
  /********************************* push data to Thing ****************************** */
  writeToThing: async (req, res) => {
    try {
      logText("write to thing....");
      console.log("we are in");
      const { quantityKind, value, apiKey } = req.body;
      const { tenant } = req.query;

      if (tenant && quantityKind && value && apiKey) {
        console.log("the organisation: ", tenant);
        console.log(
          "the field we are updating",
          writeToThingMappings(quantityKind, res)
        );
        await axios
          .get(
            constants.ADD_VALUE(
              writeToThingMappings(quantityKind),
              value,
              apiKey
            )
          )
          .then(function(response) {
            console.log(response.data);
            let output = response.data;
            let resp = {};
            resp.channel_id = response.data.channel_id;
            resp.created_at = response.data.created_at;
            resp.entry_id = response.data.entry_id;
            res.status(200).json({
              message: "successfully written data to the device",
              success: true,
              data: resp,
            });
          })
          .catch(function(error) {
            console.log(error);
            res.status(500).json({
              message:
                "unable to get channel details necessary for writing this data",
              success: false,
              error: error.response.data,
            });
          });
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "unable to push data",
        error: e.message,
      });
    }
  },

  writeToThingJSON: async (req, res) => {
    try {
      logText("write to thing json.......");
      let { tenant } = req.query;
      let {
        api_key,
        created_at,
        pm2_5,
        pm10,
        s2_pm2_5,
        s2_pm10,
        latitude,
        longitude,
        battery,
        other_data,
        status,
      } = req.body;

      let requestBody = {
        api_key: api_key,
        created_at: created_at,
        field1: pm2_5,
        field2: pm10,
        field3: s2_pm2_5,
        field4: s2_pm10,
        field5: latitude,
        field6: longitude,
        field7: battery,
        field8: other_data,
        latitude: latitude,
        longitude: longitude,
        status: status,
      };

      if (tenant) {
        await axios
          .post(constants.ADD_VALUE_JSON, requestBody)
          .then(function(response) {
            console.log(response.data);
            let output = response.data;
            let resp = {};
            resp.channel_id = response.data.channel_id;
            resp.created_at = response.data.created_at;
            resp.entry_id = response.data.entry_id;
            res.status(200).json({
              message: "successfully written data to the device",
              success: true,
              update: resp,
            });
          })
          .catch(function(error) {
            console.log(error);
            res.status(500).json({
              message:
                "unable to get channel details necessary for writing this data",
              success: false,
              error: error.response.data,
            });
          });
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "missing request parameters, please crosscheck with the API documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "unable to push data",
        error: e.message,
      });
    }
  },

  bulkWriteToThing: async (req, res) => {
    try {
      logText("bulk write to thing.......");
      let tenant = req.query;
      let { write_api_key, updates } = req.body;
      if ((write_api_key, updates, tenant)) {
        await axios
          .post(constants.BULK_ADD_VALUES_JSON(channel), body)
          .then(function(response) {
            console.log(response.data);
            let output = response.data;
            res.status(200).json({
              message: "successfully written data to the device",
              success: true,
              data: output,
            });
          })
          .catch(function(error) {
            console.log(error);
            res.status(500).json({
              message:
                "unable to get channel details necessary for writing this data",
              success: false,
              error,
            });
          });
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing request parameters, please check documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "unable to push data",
        error: e.message,
      });
    }
  },
};

module.exports = createEvent;
