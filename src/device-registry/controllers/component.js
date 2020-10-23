const ComponentSchema = require("../models/Component");
const DeviceSchema = require("../models/Device");
const ComponentTypeSchema = require("../models/ComponentType");
const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const constants = require("../config/constants");
const isEmpty = require("is-empty");
const EventSchema = require("../models/Event");
const axios = require("axios");
const {
  uniqueNamesGenerator,
  NumberDictionary,
} = require("unique-names-generator");
const { getModelByTenant } = require("../utils/multitenancy");

const getApiKeys = async (deviceName, tenant) => {
  logText("...................................");
  logText("getting api keys...");
  const deviceDetails = await getModelByTenant(
    tenant.toLowerCase(),
    "component",
    ComponentSchema
  )
    .find({
      name: deviceName,
    })
    .exec();
  logElement("the write key", deviceDetails.writeKey);
  logElement("the read key", deviceDetails.readKey);
  const writeKey = deviceDetails.writeKey;
  const readKey = deviceDetails.readKey;
  return { writeKey, readKey };
};

const getArrayLength = async (array, model, event) => {};

const generateDateFormat = async (ISODate) => {
  date = new Date(ISODate);
  year = date.getFullYear();
  month = date.getMonth() + 1;
  dt = date.getDate();

  if (dt < 10) {
    dt = "0" + dt;
  }
  if (month < 10) {
    month = "0" + month;
  }

  return `${year}-${month}-${dt}`;
};

const doesDeviceExist = async (deviceName, tenant) => {
  try {
    logText(".......................................");
    logText("doesDeviceExist?...");
    const device = await getModelByTenant(
      tenant.toLowerCase(),
      "component",
      ComponentSchema
    )
      .find({
        name: deviceName,
      })
      .exec();
    logElement("device element", device);
    logObject("device Object", device);
    logElement("does device exist?", !isEmpty(device));
    if (!isEmpty(device)) {
      return true;
    } else if (isEmpty(device)) {
      return false;
    }
  } catch (e) {
    logElement("unable to check device existence in system", e);
    return false;
  }
};

const doesComponentExist = async (componentName, deviceName, tenant) => {
  try {
    logText(".......................................");
    logText("doesComponentExist?...");
    const component = await getModelByTenant(
      tenant.toLowerCase(),
      "component",
      ComponentSchema
    )
      .find({
        name: componentName,
        deviceID: deviceName,
      })
      .exec();
    logElement("component element", component);
    logObject("component Object", component);
    logElement("does component exist?", !isEmpty(component));
    if (!isEmpty(component)) {
      return true;
    } else if (isEmpty(ComponentDetails)) {
      return false;
    }
  } catch (e) {
    logElement("unable to check Component existence in system", e);
    return false;
  }
};

const doesComponentTypeExist = async (name, tenant) => {
  try {
    logText(".......................................");
    logText("doesComponentExist?...");
    const componentType = await getModelByTenant(
      tenant.toLowerCase(),
      "componentType",
      ComponentTypeSchema
    )
      .find({
        name: name,
      })
      .exec();
    logElement("component type element", componentType);
    logObject("component type Object", componentType);
    logElement("does component type exist?", !isEmpty(componentType));
    if (!isEmpty(componentType)) {
      return true;
    } else if (isEmpty(componentType)) {
      return false;
    }
  } catch (e) {
    logElement("unable to check component type existence in system", e);
    return false;
  }
};

const Component = {
  listAll: async (req, res) => {
    try {
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
      logText("...........................................");
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
      logText("...........................................");
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
      const { device, component, tenant } = req.query;

      const {
        value,
        raw,
        weight,
        frequency,
        time,
        calibratedValue,
        measurement,
        uncertaintyValue,
        standardDeviationValue,
      } = req.body;
      logObject("the type of device name", typeof device);
      if (
        !isEmpty(value) &&
        !isEmpty(raw) &&
        !isEmpty(weight) &&
        !isEmpty(frequency) &&
        !isEmpty(device) &&
        !isEmpty(time) &&
        !isEmpty(component) &&
        !isEmpty(calibratedValue) &&
        !isEmpty(measurement) &&
        !isEmpty(uncertaintyValue) &&
        !isEmpty(standardDeviationValue) &&
        !isEmpty(tenant)
      ) {
        const isComponentPresent = await doesComponentExist(
          component,
          device,
          tenant.toLowerCase()
        );
        logElement("does component exist", isComponentPresent);

        if (isComponentPresent) {
          const sample = {
            value,
            raw,
            weight,
            frequency,
            time,
            calibratedValue,
            measurement,
            uncertaintyValue,
            standardDeviationValue,
          };
          const day = await generateDateFormat(time);
          const eventBody = {
            componentName: component,
            deviceName: device,
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
            const samples = { ...sample };
            const event = {
              values: samples,
              component: component,
              device: device,
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
            message: `the component (${component}) does not exist for this device (${device})`,
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
      logText("adding values...");
      const { device, component, tenant } = req.query;
      const { values, time } = req.body;
      logObject("the type of device name", typeof device);
      if (
        !isEmpty(time) &&
        !isEmpty(values) &&
        !isEmpty(device) &&
        !isEmpty(component) &&
        !isEmpty(tenant)
      ) {
        const isComponentPresent = await doesComponentExist(
          component,
          device,
          tenant.toLowerCase()
        );
        logElement("does component exist", isComponentPresent);

        if (isComponentPresent) {
          const samples = values;
          // const day = new Date(time);
          const day = generateDateFormat(time);
          const eventBody = {
            componentName: component,
            deviceName: device,
            day: day,
            nValues: { $lt: constants.N_VALUES },
          };
          const options = {
            $push: { values: samples },
            $min: { first: time },
            $max: { last: time },
            $inc: { nValues: samples.length },
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
            /**
             * add the component name in the response body
             */
            // const samples = { ...samples };
            const event = {
              values: samples,
              component: component,
              device: device,
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
            message: `the component (${component}) does not exist for this device (${device})`,
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

  getValues: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { comp, device, tenant } = req.query;
      logElement("device name ", device);
      logElement("Component name ", comp);
      if (comp && device) {
        const event = await getModelByTenant(tenant, "event", EventSchema)
          .find({
            componentName: comp,
            deviceName: device,
          })
          .exec();
        if (!isEmpty(event)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "successfully listed one Event",
            event,
          });
        } else if (isEmpty(event)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find that Component ${comp} for device ${device}`,
          });
        }
      } else if (device && !comp) {
        const events = await getModelByTenant(tenant, "event", EventSchema)
          .find({
            deviceID: device,
          })
          .exec();
        if (!isEmpty(events)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: `successfully listed the Events for device ${device}`,
            events,
          });
        } else if (isEmpty(events)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find the Events for device ${device}`,
          });
        }
      } else if (!device && !comp) {
        const events = await getModelByTenant(
          tenant,
          "event",
          EventSchema
        ).list({ limit, skip });
        if (!isEmpty(events)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "successfully listed all platform Events",
            tip:
              "use documented query parameters (device/comp) to filter your search results",
            events,
          });
        } else if (isEmpty(events)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find all the platform Events`,
          });
        }
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "unable to list any Event",
        error: e.message,
      });
    }
  },

  /********************************* push data to Thing ****************************** */
  writeToThing: async (req, res) => {
    try {
      const { field, value, apiKey } = req.body;
      let tenant = req.query;
      if ((field, value, apiKey, tenant)) {
        await axios
          .get(constants.ADD_VALUE(field, value, apiKey))
          .then(function(response) {
            console.log(response.data);
            updateUrl = `https://api.thingspeak.com/update.json?api_key=${response.data.api_keys[0].api_key}`;
            axios
              .post(updateUrl, req.body)
              .then(function(response) {
                console.log(response.data);
                let output = response.data;
                res.status(200).json({
                  message: "successfully written data to the device",
                  success: true,
                  output,
                });
              })
              .catch(function(error) {
                console.log(error);
                res.status(500).json({
                  message: "unable to write data to the device",
                  success: false,
                  error,
                });
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

  bulkWriteToThing: (req, res) => {},

  calibrate: async (req, res) => {
    let { comp, device, tenant } = req.query;
    try {
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
