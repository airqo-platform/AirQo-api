const Component = require("../models/Component");
const Device = require("../models/Device");
const HTTPStatus = require("http-status");
const { logObject, logText, logSingleText } = require("../utils/log");
const constants = require("../config/constants");
const isEmpty = require("is-empty");
const Event = require("../models/Event");

const getApiKeys = async (deviceName) => {
  logText("...................................");
  logText("getting api keys...");
  const deviceDetails = await Device.find({ name: deviceName }).exec();
  logSingleText("the write key", deviceDetails.writeKey);
  logSingleText("the read key", deviceDetails.readKey);
  const writeKey = deviceDetails.writeKey;
  const readKey = deviceDetails.readKey;
  return { writeKey, readKey };
};

const getArrayLength = async (array, model, event) => {};

const component = {
  listAll: async (req, res) => {
    const limit = parseInt(req.query.limit, 0);
    const skip = parseInt(req.query.skip, 0);

    try {
      const components = await Component.list({ limit, skip });
      return res.status(HTTPStatus.OK).json(components);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  addComponent: async (req, res) => {
    /**
     * need to map this component to the TS field
     */
    let {
      quantityKind,
      name,
      measurementUnit,
      description,
      calibration,
    } = req.body;

    let deviceBody = {
      ...req.body,
      deviceID: req.params.d_id,
    };

    /****
     * ----calibrationBody
     *   valueMax: {
        sensorValue: 23,
        realValue: 34,
      },
      valueMin: {
        sensorValue: 10,
        realValue: 11,
      },
     */

    try {
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
        error: e,
      });
    }
  },

  listOne: async (req, res) => {
    try {
      const component = await Component.find({ name: req.params.c_id }).exec();
      return res.status(HTTPStatus.OK).json({
        success: true,
        message: "successfully listed one component",
        component,
      });
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "unable to list one component",
        error: e,
      });
    }
  },

  deleteComponent: async (req, res) => {
    let { c_id, d_id } = req.params;
    let componentFilter = { name: c_id };

    try {
      Component.findOneAndRemove(componentFilter, (err, removedComponent) => {
        if (err) {
          return res.status(HTTPStatus.OK).json({
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
      });
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ e, success: false, message: "unable to delete the component" });
    }
  },

  updateComponent: async (req, res) => {
    let { c_id, d_id } = req.params;
    try {
      let componentFilter = { name: c_id };
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
            return res.status(HTTPStatus.BAD_REQUEST).json({
              message:
                "component does not exist, please first create the component you are trying to update ",
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

  addValues: async (req, res) => {
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
        value,
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

      let { writeKey, readKey } = getApiKeys(d_id);
      if (d_id && c_id) {
        const url = constants.ADD_VALUE(fields[0], value, writeKey);
        let eventBody = {
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

  addValue: async (req, res) => {
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
