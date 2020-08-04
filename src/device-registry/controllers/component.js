const Component = require("../models/Component");
const Device = require("../models/Device");
const HTTPStatus = require("http-status");
const { logObject, logText, logElement } = require("../utils/log");
const constants = require("../config/constants");
const isEmpty = require("is-empty");
const Event = require("../models/Event");
const { uniqueNamesGenerator } = require("unique-names-generator");

const getApiKeys = async (deviceName) => {
  logText("...................................");
  logText("getting api keys...");
  const deviceDetails = await Device.find({ name: deviceName }).exec();
  logElement("the write key", deviceDetails.writeKey);
  logElement("the read key", deviceDetails.readKey);
  const writeKey = deviceDetails.writeKey;
  const readKey = deviceDetails.readKey;
  return { writeKey, readKey };
};

const getArrayLength = async (array, model, event) => {};

const component = {
  listAll: async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let { comp, device } = req.query;
      logElement("device name ", device);
      logElement("component name ", comp);
      if (comp && device) {
        const component = await Component.find({
          name: comp,
          deviceID: device,
        }).exec();
        if (!isEmpty(component)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "successfully listed one component",
            component,
          });
        } else if (isEmpty(component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find that component ${comp} for device ${device}`,
          });
        }
      } else if (device && !comp) {
        const components = await Component.find({ deviceID: device }).exec();
        if (!isEmpty(components)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: `successfully listed the components for device ${device}`,
            components,
          });
        } else if (isEmpty(components)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find the components for device ${device}`,
          });
        }
      } else if (!device && !comp) {
        const components = await Component.list({ limit, skip });
        if (!isEmpty(components)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "successfully listed all platform components",
            tip:
              "use documented query parameters (device/comp) to filter your search results",
            components,
          });
        } else if (isEmpty(components)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `unable to find all the platform components`,
          });
        }
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "unable to list any component",
        error: e.message,
      });
    }
  },

  addComponent: async (req, res) => {
    logText("................................");
    logText("adding component....");

    try {
      let { device } = req.query;
      let { measurement, description } = req.body;
      logObject("measurement", measurement);
      logObject("description", description);

      const comp = ["comp"];
      const deviceName = [];
      deviceName.push(device);
      const kind = [];
      kind.push(measurement.quantityKind);

      let componentName = uniqueNamesGenerator({
        dictionaries: [deviceName, comp, kind],
        separator: "_",
        length: 3,
      });
      logElement("component name", componentName);

      let deviceBody = {
        ...req.body,
        deviceID: device,
        name: componentName,
      };

      const component = await Component.createComponent(deviceBody);
      return res.status(HTTPStatus.CREATED).json({
        success: true,
        message: "successfully created the component",
        component,
      });
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "unable to create the component",
        error: e.message,
      });
    }
  },

  deleteComponent: async (req, res) => {
    try {
      logText("...........................................");
      let { device, comp } = req.query;
      if (component && device) {
        const component = await Component.find({
          name: comp,
          deviceID: device,
        }).exec();
        logElement(`Does "${comp}" exist on "${device}"?`, !isEmpty(component));

        if (isEmpty(component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `component "${comp}" of device "${device}" does not exist in the platform`,
          });
        }
        let componentFilter = { name: comp };
        if (!isEmpty(component)) {
          Component.findOneAndRemove(
            componentFilter,
            (err, removedComponent) => {
              if (err) {
                return res.status(HTTPStatus.BAD_GATEWAY).json({
                  err,
                  success: false,
                  message: "unable to delete component",
                });
              } else {
                return res.status(HTTPStatus.OK).json({
                  removedComponent,
                  success: true,
                  message: " component successfully deleted",
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
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ e, success: false, message: "unable to delete the component" });
    }
  },

  updateComponent: async (req, res) => {
    try {
      logText("...........................................");
      let { device, comp } = req.query;
      if (component && device) {
        const component = await Component.find({
          name: comp,
          deviceID: device,
        }).exec();
        logElement(`Does "${comp}" exist on "${device}"?`, !isEmpty(component));

        if (isEmpty(component)) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: `component "${comp}" of device "${device}" does not exist in the platform`,
          });
        }

        let componentFilter = { name: comp };

        await Component.findOneAndUpdate(
          componentFilter,
          req.body,
          {
            new: true,
          },
          (error, updatedComponent) => {
            if (error) {
              return res.status(HTTPStatus.BAD_GATEWAY).json({
                message: "unable to update component",
                error,
                success: false,
              });
            } else if (updatedComponent) {
              return res.status(HTTPStatus.OK).json({
                message: "successfully updated the component settings",
                updatedComponent,
                success: true,
              });
            } else {
              logObject("the updated component", updatedComponent);
              return res.status(HTTPStatus.BAD_REQUEST).json({
                message: "unable to update the component ",
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
      let { d_id, c_id } = req.params;
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

      let { writeKey, readKey } = getApiKeys(d_id);
      if (d_id && c_id) {
        const url = constants.ADD_VALUE(fields[0], value[0], writeKey);
        let eventBody = {
          deviceID: d_id,
          sensorID: c_id,
          $addToSet: { values: { $each: value } },
        };
        const event = await Event.createEvent(eventBody);
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
        logText("component and/or device ID are missing in the request params");
      }
    } catch (e) {
      res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ e, message: "unable to add the value", success: false });
    }
  },

  addValues: async (req, res) => {
    try {
      let { c_id, d_id } = req.params;
      let { values, timestamp } = req.body;
      let eventBody = {
        $addToSet: { values: { $each: values } },
      };

      //check the rights of the current user
      if (!component.owner.equals(req.user._id)) {
        res.status(HTTPStatus.UNAUTHORIZED);
      }
    } catch (e) {
      res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        error: e,
        message: "unable to add the values",
      });
    }
  },

  calibrate: async (req, res) => {
    let { c_id, d_id } = req.params;
    try {
      let componentFilter = { name: c_id };
      await Component.findOneAndUpdate(
        componentFilter,
        { ...req.body, deviceID: d_id },
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
                "component does not exist, please first create the component you are trying to calibrate ",
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

module.exports = component;
