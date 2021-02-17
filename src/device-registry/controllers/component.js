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
const {
  responseAll,
  responseDateRanges,
  responseDevice,
  responseDeviceAndComponent,
  responseComponent,
} = require("utils/get-events");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const {
  getApiKeys,
  getArrayLength,
  generateDateFormat,
  doesDeviceExist,
  doesComponentExist,
  doesComponentTypeExist,
} = require("../utils/componentControllerHelpers");

const Component = {
  listAll: async (req, res) => {
    try {
      logText("list components.......");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { comp, device, tenant } = req.query;

      if (tenant) {
        logElement("device name ", device);
        logElement("Component name ", comp);
        if (comp && device) {
          const component = await getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          )
            .find({
              name: comp,
              deviceID: device,
            })
            .exec();
          if (!isEmpty(component)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "successfully listed one Component",
              component,
            });
          } else if (isEmpty(component)) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: `unable to find that Component ${comp} for device ${device}`,
            });
          }
        } else if (device && !comp) {
          const components = await getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          )
            .find({
              deviceID: device,
            })
            .exec();
          if (!isEmpty(components)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: `successfully listed the Components for device ${device}`,
              components,
            });
          } else if (isEmpty(components)) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: `unable to find the Components for device ${device}`,
            });
          }
        } else if (!device && !comp) {
          const components = await getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          ).list({ limit, skip });
          if (!isEmpty(components)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "successfully listed all platform Components",
              tip:
                "use documented query parameters (device/comp) to filter your search results",
              components,
            });
          } else if (isEmpty(components)) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: `unable to find all the platform Components`,
            });
          }
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "unable to list any Component",
        error: e.message,
      });
    }
  },

  addComponent: async (req, res) => {
    logText("................................");
    logText("adding Component....");

    try {
      let { device, tenant, ctype } = req.query;
      let { measurement, description } = req.body;

      /**
       * check that all the request body elements are present
       */

      if (device && ctype && measurement && description && tenant) {
        const isDevicePresent = await doesDeviceExist(device);
        logElement("isDevicePresent ?", isDevicePresent);

        const isComponentTypePresent = await doesComponentTypeExist(
          ctype,
          tenant.toLowerCase()
        );
        logElement("isComponentTypePresent ?", isComponentTypePresent);

        logObject("measurement", measurement);
        logElement("description", description);

        let componentName = `${device.trim()}_${ctype.trim()}`;

        /***
         * create component name based on component type
         * 
         *if the component type does not exist, 
         then alert the user and encourage them to first create the component type 
         
         Otherwise, use it to generate the component name
         */

        if (isComponentTypePresent) {
          let componentBody = {
            ...req.body,
            deviceID: device,
            name: componentName,
          };

          const component = await getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          ).createComponent(componentBody);

          logElement("the component element", component);
          logObject("the component object", component);

          return res.status(HTTPStatus.CREATED).json({
            success: true,
            message: "successfully created the component",
            component,
          });
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message:
              "the component TYPE does not exist for this network, please first create it",
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "Required body and query parameters are missing in this request, please crosscheck documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "unable to create the Component",
        error: e.message,
      });
    }
  },

  deleteComponent: async (req, res) => {
    try {
      logText("delete component...................");
      let { device, comp, tenant } = req.query;
      if ((comp && device, tenant)) {
        const component = await getModelByTenant(
          tenant.toLowerCase(),
          "component",
          ComponentSchema
        )
          .find({
            name: comp,
            deviceID: device,
          })
          .exec();
        logElement(`Does "${comp}" exist on "${device}"?`, !isEmpty(component));

        if (isEmpty(component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `Component "${comp}" of device "${device}" does not exist in the platform`,
          });
        }
        let ComponentFilter = { name: comp };
        if (!isEmpty(component)) {
          getModelByTenant(
            tenant.toLowerCase(),
            "component",
            ComponentSchema
          ).findOneAndRemove(ComponentFilter, (err, removedComponent) => {
            if (err) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                err,
                success: false,
                message: "unable to delete Component",
              });
            } else {
              return res.status(HTTPStatus.OK).json({
                removedComponent,
                success: true,
                message: " Component successfully deleted",
              });
            }
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "please crosscheck your query parameters using the API documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        e,
        success: false,
        message: "unable to delete the Component",
      });
    }
  },

  updateComponent: async (req, res) => {
    try {
      logText("update component.................");
      let { device, comp, tenant } = req.query;
      if (comp && device && tenant) {
        const component = await getModelByTenant(
          tenant.toLowerCase(),
          "component",
          ComponentSchema
        )
          .find({
            name: comp,
            deviceID: device,
          })
          .exec();
        logElement(`Does "${comp}" exist on "${device}"?`, !isEmpty(component));

        if (isEmpty(component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `Component "${comp}" of device "${device}" does not exist in the platform`,
          });
        }

        let componentFilter = { name: comp };

        await getModelByTenant(
          tenant.toLowerCase(),
          "component",
          ComponentSchema
        ).findOneAndUpdate(
          componentFilter,
          req.body,
          {
            new: true,
          },
          (error, updatedComponent) => {
            if (error) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: "unable to update Component",
                error,
                success: false,
              });
            } else if (updatedComponent) {
              return res.status(HTTPStatus.OK).json({
                message: "successfully updated the Component settings",
                updatedComponent,
                success: true,
              });
            } else {
              logObject("the updated Component", updatedComponent);
              return res.status(HTTPStatus.BAD_REQUEST).json({
                message: "unable to update the Component ",
                success: false,
              });
            }
          }
        );
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "please crosscheck your query parameters using the API documentation, some are missing",
        });
      }
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ error: e, messsage: "this is a bad request", success: false });
    }
  },

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

      const {
        calibratedValue,
        raw,
        frequency,
        time,
        uncertaintyValue,
        standardDeviationValue,
        sensor,
      } = req.body;

      if (
        !isEmpty(raw) &&
        !isEmpty(frequency) &&
        !isEmpty(device) &&
        !isEmpty(time) &&
        !isEmpty(sensor) &&
        !isEmpty(calibratedValue) &&
        !isEmpty(uncertaintyValue) &&
        !isEmpty(standardDeviationValue) &&
        !isEmpty(tenant)
      ) {
        const isComponentPresent = await doesComponentExist(
          sensor,
          device,
          tenant.toLowerCase()
        );
        logElement("does component exist", isComponentPresent);

        if (isComponentPresent) {
          const sample = {
            raw,
            frequency,
            time,
            calibratedValue,
            uncertaintyValue,
            standardDeviationValue,
            sensor,
          };
          const day = await generateDateFormat(time);
          const eventBody = {
            device: device,
            day: day,
            nValues: { $lt: constants.N_VALUES },
          };
          const options = {
            $push: { values: sample },
            $min: { first: sample.time },
            $max: { last: sample.time },
            $inc: { nValues: 1 },
          };

          const addedEvent = await getModelByTenant(
            tenant.toLowerCase(),
            "event",
            EventSchema
          ).updateOne(eventBody, options, {
            upsert: true,
          });

          logObject("the inserted document", addedEvent);

          if (addedEvent) {
            /**
             * add the component name in the response body
             */
            console.log("sample: ", sample);
            console.log("device: ", device);
            // const samples = { ...sample };
            const event = {
              ...sample,
              device,
            };
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "successfully added the device data",
              event,
            });
          } else if (!addedEvent) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              message: "unable to add events",
              success: false,
            });
          } else {
            logText("just unable to add events");
          }
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `the sensor (${sensor}) does not exist for this device (${device})`,
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

  addBulk: async (req, res) => {
    try {
      logText("adding values in bulk...");
      const { device, tenant } = req.query;
      const { values, time } = req.body;
      logObject("the type of device name", typeof device);
      if (
        !isEmpty(time) &&
        !isEmpty(values) &&
        !isEmpty(device) &&
        !isEmpty(tenant)
      ) {
        const isDevicePresent = await doesDeviceExist(
          device,
          tenant.toLowerCase()
        );

        logElement("does device exist", isDevicePresent);

        if (isDevicePresent) {
          const day = await generateDateFormat(time);
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
            logElement("does component exist", isComponentPresent);
            return (isComponentPresent = true);
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

          logObject("the inserted document", addedEvent);

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

  createType: async (req, res) => {
    logText("................................");
    logText("adding component type....");

    try {
      logText("create types.......");
      let { name, tenant } = req.query;

      if (name && tenant) {
        const isComponentTypeExist = await doesComponentTypeExist(
          name,
          tenant.toLowerCase()
        );
        logElement("does component type exist", isComponentTypeExist);

        let componentTypeBody = {
          name: name,
        };

        const componentType = await getModelByTenant(
          tenant.toLowerCase(),
          "componentType",
          ComponentTypeSchema
        ).createComponentType(componentTypeBody);

        logElement("the component type element", componentType);
        logObject("the component type object", componentType);

        return res.status(HTTPStatus.CREATED).json({
          success: true,
          message: "successfully created the component type",
          componentType,
        });
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "request parameters missing, please check API documentation",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "unable to create the component type",
        error: e.message,
      });
    }
  },
  getTypes: async (req, res) => {
    try {
      logText("get types.......");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let { name, tenant } = req.query;
      logElement("the component type ", name);
      if (name && tenant) {
        const componentType = await getModelByTenant(
          tenant.toLowerCase(),
          "componentType",
          ComponentTypeSchema
        ).find({
          name: name,
        });

        return res.status(HTTPStatus.OK).json({
          success: true,
          message: `successfully listed the details of this platform's componentType `,
          componentType,
          doesExist: !isEmpty(componentType),
        });
      } else if (!name && tenant) {
        const componentTypes = await getModelByTenant(
          tenant.toLowerCase(),
          "componentType",
          ComponentTypeSchema
        ).list({
          limit,
          skip,
        });
        if (!isEmpty(componentTypes)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "successfully listed all platform componentTypes",
            componentTypes,
          });
        } else if (isEmpty(componentTypes)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find all the platform componentTypes`,
          });
        }
      } else if (!tenant) {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: `missing the organisation, please crosscheck API documentation`,
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "unable to list any component type",
        error: e.message,
      });
    }
  },

  getValues: (req, res) => {
    try {
      const { device, tenant } = req.query;
      logText("get values.......");
      logElement("device name ", device);
      if (device && tenant) {
        responseDevice(res, { device: device }, tenant);
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

  calibrate: async (req, res) => {
    let { comp, device, tenant } = req.query;
    try {
      logText("calibrate.......");
      let ComponentFilter = { name: comp };
      await getModelByTenant(
        tenant.toLowerCase(),
        "component",
        ComponentSchema
      ).findOneAndUpdate(
        ComponentFilter,
        { ...req.body, deviceID: device },
        {
          new: true,
        },
        (error, updatedComponent) => {
          if (error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              message: "unable to calibrate",
              error,
              success: false,
            });
          } else if (updatedComponent) {
            return res.status(HTTPStatus.OK).json({
              message: "successfully calibrated the device",
              updatedComponent,
              success: true,
            });
          } else {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              message:
                "Component does not exist, please first create the Component you are trying to calibrate ",
              success: false,
            });
          }
        }
      );
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ error: e, messsage: "this is a bad request", success: false });
    }
  },
};

module.exports = Component;
