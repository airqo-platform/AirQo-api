const ComponentSchema = require("../models/Component");
const DeviceSchema = require("../models/Device");
const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const constants = require("../config/constants");
const isEmpty = require("is-empty");
const EventSchema = require("../models/Event");
const {
  uniqueNamesGenerator,
  NumberDictionary,
} = require("unique-names-generator");
const { getModelByTenant } = require("../utils/multitenancy");

const ComponentModel = (tenant) => {
  getModelByTenant(tenant, "component", ComponentSchema);
};

const DeviceModel = (tenant) => {
  getModelByTenant(tenant, "device", DeviceSchema);
};
const EventModel = (tenant) => {
  getModelByTenant(tenant, "event", EventSchema);
};

const getApiKeys = async (deviceName) => {
  logText("...................................");
  logText("getting api keys...");
  const { tenant } = req.query;
  const deviceDetails = await ComponentModel(tenant)
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

const doesDeviceExist = async (deviceName) => {
  try {
    logText(".......................................");
    logText("doesDeviceExist?...");
    const device = await Component.find({
      name: deviceName,
    }).exec();
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

const doesComponentExist = async (componentName, deviceName) => {
  try {
    logText(".......................................");
    logText("doesComponentExist?...");
    const component = await Component.find({
      name: componentName,
      deviceID: deviceName,
    }).exec();
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

const Component = {
  listAll: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let { comp, device } = req.query;
      logElement("device name ", device);
      logElement("Component name ", comp);
      const { tenant } = req.query;
      if (comp && device) {
        const Component = await ComponentModel(tenant)
          .find({
            name: comp,
            deviceID: device,
          })
          .exec();
        if (!isEmpty(Component)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "successfully listed one Component",
            Component,
          });
        } else if (isEmpty(Component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find that Component ${comp} for device ${device}`,
          });
        }
      } else if (device && !comp) {
        const Components = await ComponentModel(tenant)
          .find({
            deviceID: device,
          })
          .exec();
        if (!isEmpty(Components)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: `successfully listed the Components for device ${device}`,
            Components,
          });
        } else if (isEmpty(Components)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find the Components for device ${device}`,
          });
        }
      } else if (!device && !comp) {
        const Components = await ComponentModel(tenant).list({ limit, skip });
        if (!isEmpty(Components)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "successfully listed all platform Components",
            tip:
              "use documented query parameters (device/comp) to filter your search results",
            Components,
          });
        } else if (isEmpty(Components)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find all the platform Components`,
          });
        }
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
      let { device, tenant } = req.query;
      let { measurement, description } = req.body;

      let isComponentPresent = await doesDeviceExist(device);
      logElement("isComponentPresent ?", isComponentPresent);

      logObject("measurement", measurement);
      logObject("description", description);

      const comp = ["comp"];
      const deviceName = [];
      deviceName.push(device);
      const numberDictionary = NumberDictionary.generate({
        min: 0,
        max: 99,
      });
      let ComponentName = uniqueNamesGenerator({
        dictionaries: [deviceName, comp, numberDictionary],
        separator: "_",
        length: 3,
      });

      logElement("Component name", ComponentName);
      logElement("ComponentNameWhendeviceExists", ComponentName);

      let ComponentBody = {
        ...req.body,
        deviceID: device,
        name: ComponentName,
      };

      const Component = await ComponentModel(tenant).createComponent(
        ComponentBody
      );

      logElement("the Component element", Component);
      logObject("the Component object", Component);

      return res.status(HTTPStatus.CREATED).json({
        success: true,
        message: "successfully created the Component",
        Component,
      });
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
      if (Component && device) {
        const Component = await ComponentModel(tenant)
          .find({
            name: comp,
            deviceID: device,
          })
          .exec();
        logElement(`Does "${comp}" exist on "${device}"?`, !isEmpty(Component));

        if (isEmpty(Component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `Component "${comp}" of device "${device}" does not exist in the platform`,
          });
        }
        let ComponentFilter = { name: comp };
        if (!isEmpty(Component)) {
          Component.findOneAndRemove(
            ComponentFilter,
            (err, removedComponent) => {
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
            }
          );
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "please crosscheck your query parameters, should contain both device & comp for this usecase",
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
      if (Component && device) {
        const Component = await ComponentModel(tenant)
          .find({
            name: comp,
            deviceID: device,
          })
          .exec();
        logElement(`Does "${comp}" exist on "${device}"?`, !isEmpty(Component));

        if (isEmpty(Component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `Component "${comp}" of device "${device}" does not exist in the platform`,
          });
        }

        let ComponentFilter = { name: comp };

        await ComponentModel(tenant).findOneAndUpdate(
          ComponentFilter,
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
            "please crosscheck your query parameters, should contain both device & comp for this usecase",
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

      let { writeKey, readKey } = getApiKeys(device);
      if (device && comp) {
        const url = constants.ADD_VALUE(fields[0], value[0], writeKey);
        let eventBody = {
          deviceID: device,
          sensorID: comp,
          $addToSet: { values: { $each: value } },
        };
        const event = await EventModel(tenant).createEvent(eventBody);
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
        !isEmpty(standardDeviationValue)
      ) {
        const isComponentExist = await doesComponentExist(component, device);
        logElement("does component exist", isComponentExist);
        if (isComponentExist) {
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
          const day = new Date(time);
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

          const addedEvent = await EventModel(tenant).updateOne(
            eventBody,
            options,
            {
              upsert: true,
            }
          );

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
            message: "the component does not exist",
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

  /********************************* push data to Thing ****************************** */
  writeToThing: async (req, res) => {
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
  },

  bulkWriteToThing: (req, res) => {},

  calibrate: async (req, res) => {
    let { comp, device, tenant } = req.query;
    try {
      let ComponentFilter = { name: comp };
      await ComponentModel(tenant).findOneAndUpdate(
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
