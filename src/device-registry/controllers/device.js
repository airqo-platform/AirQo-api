const ComponentSchema = require("../models/Component");
const DeviceSchema = require("../models/Device");
const LocationActivitySchema = require("../models/location_activity");
const Location = require("../models/Location");
const HTTPStatus = require("http-status");
const iot = require("@google-cloud/iot");
const isEmpty = require("is-empty");
const client = new iot.v1.DeviceManagerClient();
const device_registry =
  "projects/airqo-250220/locations/europe-west1/registries/device-registry";
const uuidv1 = require("uuid/v1");
const mqtt = require("mqtt");
const projectId = "airqo-250220";
const region = `europe-west1`;
const registryId = `device-registry`;
const algorithm = `RS256`;
// const privateKeyFile = `./rsa_private.pem`;
const mqttBridgeHostname = `mqtt.googleapis.com`;
const mqttBridgePort = 8883;
const messageType = `events`;
const numMessages = 5;
const fetch = require("node-fetch");
const request = require("request");
const axios = require("axios");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("../utils/log");
const qs = require("qs");
const redis = require("../config/redis");
const { getModelByTenant } = require("../utils/multitenancy");
const {
  createOnThingSpeak,
  createOnClarity,
} = require("../utils/integrations");

const {
  isDeviceNotDeployed,
  isDeviceNotRecalled,
  locationActivityRequestBodies,
  doLocationActivity,
  getGpsCoordinates,
  doesLocationExist,
  queryFilterOptions,
  bodyFilterOptions,
} = require("../utils/doActivityHelpers");

const {
  clearEventsBody,
  doesDeviceExist,
  updateThingBodies,
  threeMonthsFromNow,
  getChannelID,
  getApiKeys,
} = require("../utils/deviceControllerHelpers");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const deleteDevice = require("../utils/delete-device");

const device = {
  createThing: async (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        const baseUrl = constants.CREATE_THING_URL;
        let { name } = req.body;
        let { tsBody, deviceBody } = updateThingBodies(req, res);
        let prepBodyTS = {
          ...tsBody,
          ...constants.DEVICE_CREATION,
        };
        let isDevicePresent = await doesDeviceExist(name, tenant.toLowerCase());
        logElement("isDevicePresent ?", isDevicePresent);
        if (!isDevicePresent) {
          /***
           * when creating for AirQo, make call to TS
           * As for other organisations, just make a different call or just ignore
           * will put this function in a separate place as a util of sorts
           */
          logText("adding device on TS...");
          let channel;
          if (tenant.toLowerCase() === "airqo") {
            createOnThingSpeak(
              req,
              res,
              baseUrl,
              prepBodyTS,
              channel,
              device,
              deviceBody,
              tenant.toLowerCase()
            );
          } else {
            //just create the device locally
            createOnClarity(tenant.toLowerCase(), req, res);
          }
        } else {
          res.status(400).json({
            success: false,
            message: `device "${name}" already exists!`,
          });
        }
      } else {
        //missing params
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message:
            "request is missing the required query params, please crosscheck",
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  doActivity: async (req, res) => {
    try {
      const { type, tenant } = req.query;
      if (tenant && type) {
        const { deviceName } = req.body;

        const deviceExists = await doesDeviceExist(
          deviceName,
          tenant.toLowerCase()
        );
        const isNotDeployed = await isDeviceNotDeployed(
          deviceName,
          tenant.toLowerCase()
        );
        const isNotRecalled = await isDeviceNotRecalled(
          deviceName,
          tenant.toLowerCase()
        );
        const {
          locationActivityBody,
          deviceBody,
        } = locationActivityRequestBodies(req, res);

        doLocationActivity(
          res,
          deviceBody,
          locationActivityBody,
          deviceName,
          type,
          deviceExists,
          isNotDeployed,
          isNotRecalled,
          tenant.toLowerCase()
        );
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  deleteActivity: async (req, res) => {
    try {
      const { tenant, id } = req.query;
      if (tenant && id) {
        const Activity = await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          LocationActivitySchema
        );
        let filter = { _id: id };

        Activity.findOneAndDelete(filter)
          .exec()
          .then((deletedActivity) => {
            if (!isEmpty(deletedActivity)) {
              return res.status(HTTPStatus.OK).json({
                success: true,
                message: "the log has successfully been deleted",
                deletedActivity,
              });
            } else if (isEmpty(deletedActivity)) {
              return res.status(HTTPStatus.BAD_REQUEST).json({
                success: false,
                message: `there is no log by that id (${id}), please crosscheck`,
              });
            }
          })
          .catch((error) => {
            callbackErrors(error, req, res);
          });
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  updateActivity: async (req, res) => {
    try {
      const { tenant, id } = req.query;
      logElement("tenant", tenant);
      logElement("id", id);
      if (tenant && id) {
        const { activityBody } = await bodyFilterOptions(req, res);
        let filter = { _id: id };

        logObject("activity body", activityBody);

        const updatedActivity = await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          LocationActivitySchema
        ).findOneAndUpdate(filter, activityBody, {
          new: true,
        });

        if (!isEmpty(updatedActivity)) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Activity updated successfully",
            updatedActivity,
          });
        } else if (isEmpty(updatedActivity)) {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: `An activity log by this ID (${id}) could be missing, please crosscheck`,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  getActivities: async (req, res) => {
    try {
      logText(".....getting logs......................");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { tenant, device, type, location, next, id } = req.query;
      logElement("the tenant", tenant);

      const { activityFilter } = await queryFilterOptions(req, res);
      logObject("activity filter", activityFilter);

      if (tenant) {
        if (!device && !type && !location && !next && !id) {
          const locationActivities = await getModelByTenant(
            tenant.toLowerCase(),
            "activity",
            LocationActivitySchema
          ).list({
            limit,
            skip,
          });
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: "Activities fetched successfully",
            locationActivities,
          });
        } else {
          const activities = await getModelByTenant(
            tenant.toLowerCase(),
            "activity",
            LocationActivitySchema
          ).find(activityFilter);

          if (!isEmpty(activities)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "Activities fetched successfully",
              activities,
            });
          } else if (isEmpty(activities)) {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: `Your query filters have no results for this organisation (${tenant.toLowerCase()})`,
            });
          }
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  deleteThing: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      if (tenant) {
        if (!device) {
          res.status(400).json({
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          });
        }
        let deviceExist = await doesDeviceExist(device, tenant);
        if (deviceExist) {
          const channelID = await getChannelID(
            req,
            res,
            device,
            tenant.toLowerCase()
          );
          logText("deleting device from TS.......");
          logElement("the channel ID", channelID);
          await axios
            .delete(constants.DELETE_THING_URL(channelID))
            .then(async (response) => {
              deleteDevice(tenant, res, device);
            })
            .catch(function(error) {
              logElement("unable to delete device from TS", error);
              logElement("this is the error response", error.response.status);

              if (error.response.status == 404) {
                deleteDevice(tenant, res, device);
              } else {
                tryCatchErrors(res, error);
              }
            });
        } else {
          logText("device does not exist in the network");
          res.status(HTTPStatus.BAD_REQUEST).json({
            message: "device does not exist in the network",
            success: false,
            device,
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      logElement(
        "unable to carry out the entire deletion of device",
        e.message
      );
      logObject("unable to carry out the entire deletion of device", e.message);
      tryCatchErrors(res, e);
    }
  },

  deleteChannel: async (channel, req, res, error) => {
    try {
      if (!channel) {
        res.status(400).json({
          message: "the channel is missing in the request body",
          success: false,
        });
      }
      logText("deleting device from TS.......");
      logElement("the channel ID", channel);
      await axios
        .delete(constants.DELETE_THING_URL(channel))
        .then(async (response) => {
          logText("successfully deleted device from TS");
          logObject("TS response data", response.data);
          res.status(500).json({
            message: "unable to create device on platform",
            success: false,
            error: error,
          });
        })
        .catch(function(error) {
          logElement("unable to delete device from TS", error);
          res.status(500).json({
            message: "unable to delete the device from TS",
            success: false,
            error,
          });
        });
    } catch (e) {
      logElement(
        "unable to carry out the entire deletion of device",
        e.message
      );
      logObject("unable to carry out the entire deletion of device", e.message);
      tryCatchErrors(res, e);
    }
  },

  clearThing: async (req, res) => {
    try {
      const { device, tenant } = req.query;

      if (tenant) {
        if (!device) {
          res.status(400).json({
            message:
              "please use the correct query parameter, check API documentation",
            success: false,
          });
        }
        let isDevicePresent = await doesDeviceExist(device, tenant);
        logElement("isDevicePresent ?", isDevicePresent);
        if (isDevicePresent) {
          //get the thing's channel ID
          //lets first get the channel ID
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
              res.status(200).json({
                message: `successfully cleared the data for device ${device}`,
                success: true,
                updatedDevice,
              });
              //will clear data from Events table
            })
            .catch(function(error) {
              console.log(error);
              res.status(500).json({
                message: `unable to clear the device data, device ${device} does not exist`,
                success: false,
                //   error,
              });
            });
        } else {
          logText(`device ${device} does not exist in the system`);
          res.status(500).json({
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

  updateThingSettings: async (req, res) => {
    try {
      let { device, tenant } = req.query;

      if (tenant && device) {
        let isDevicePresent = await doesDeviceExist(device, tenant);
        logElement("isDevicePresent ?", isDevicePresent);

        if (isDevicePresent) {
          const channelID = await getChannelID(
            req,
            res,
            device,
            tenant.toLowerCase()
          );
          logText(".............................................");
          logText("updating the thing.......");
          logElement("the channel ID", channelID);

          const deviceFilter = { name: device };
          let { tsBody, deviceBody } = updateThingBodies(req, res);
          logObject("TS body", tsBody);
          logObject("device body", deviceBody);
          logElement("the channel ID", channelID);
          const config = {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          };
          logElement("the url", constants.UPDATE_THING(channelID));
          await axios
            .put(
              constants.UPDATE_THING(channelID),
              qs.stringify(tsBody),
              config
            )
            .then(async (response) => {
              logText(`successfully updated device ${device} in TS`);
              logObject("response from TS", response.data);
              const updatedDevice = await getModelByTenant(
                tenant.toLowerCase(),
                "device",
                DeviceSchema
              ).findOneAndUpdate(deviceFilter, deviceBody, {
                new: true,
              });
              if (updatedDevice) {
                return res.status(HTTPStatus.OK).json({
                  message: "successfully updated the device settings in DB",
                  updatedDevice,
                  success: true,
                });
              } else if (!updatedDevice) {
                return res.status(HTTPStatus.BAD_GATEWAY).json({
                  message: "unable to update device in DB but updated in TS",
                  success: false,
                });
              } else {
                logText("just unable to update device in DB but updated in TS");
              }
            })
            .catch(function(error) {
              logElement("unable to update the device settings in TS", error);
              callbackErrors(error, req, res);
            });
        } else {
          logText(`device ${device} does not exist in DB`);
          res.status(500).json({
            message: `device ${device} does not exist`,
            success: false,
          });
        }
      } else {
        missingQueryParams(req, res);
      }
    } catch (e) {
      logElement("unable to perform update operation", e);
      tryCatchErrors(res, e);
    }
  },

  /*********************** integration neutral CRUD operations  ******************/
  listAll: async (req, res) => {
    try {
      //..
      logText(".....................................");
      logText("list all devices by tenant...");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { tenant, name, chid } = req.query;

      if (tenant) {
        logElement("the channel ID", chid);
        logElement("the device name", name);
        if (tenant.toLowerCase() && name && !chid) {
          logElement("the tenant", tenant);
          logElement("the name", name);
          const device = await getModelByTenant(
            tenant.toLowerCase(),
            "device",
            DeviceSchema
          ).findOne({ name: name });
          logObject("the device", device);
          if (!isEmpty(device)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "Device fetched successfully",
              device,
            });
          } else if (isEmpty(device)) {
            return res.json({
              success: false,
              message: `this organisation (${tenant}) does not have this device or they do not exist, please crosscheck`,
            });
          }
        } else if (tenant && chid && !name) {
          logElement("the tenant", tenant);
          logElement("the channel ID", chid);
          const device = await getModelByTenant(
            tenant.toLowerCase(),
            "device",
            DeviceSchema
          ).findOne({ channelID: chid });
          logObject("the device", device);
          if (!isEmpty(device)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "Device fetched successfully",
              device,
            });
          } else if (isEmpty(device)) {
            return res.json({
              success: false,
              message: `this organisation (${tenant.toLowerCase()}) does not have this device or they do not exist, please crosscheck`,
            });
          }
        } else if (tenant && !name && !chid) {
          // const devices = await DeviceModel(tenant).list({ limit, skip });
          // return res.status(HTTPStatus.OK).json(devices);
          const devices = await getModelByTenant(
            tenant.toLowerCase(),
            "device",
            DeviceSchema
          ).list({ limit, skip });
          if (!isEmpty(devices)) {
            return res.status(HTTPStatus.OK).json({
              success: true,
              message: "Devices fetched successfully",
              devices,
            });
          } else if (isEmpty(devices)) {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: `this organisation (${tenant.toLowerCase()}) does not have devices or it does not exist, please crosscheck`,
            });
          }
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message:
              "request is missing the required query params, please crosscheck",
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  listAllByLocation: async (req, res) => {
    try {
      const { tenant, loc } = req.query;
      logElement("location ", loc);
      try {
        if (tenant) {
          const devices = await getModelByTenant(
            tenant.toLowerCase(),
            "device",
            DeviceSchema
          )
            .find({ locationID: loc })
            .exec();
          return res.status(HTTPStatus.OK).json(devices);
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: "missing query params, please check documentation",
          });
        }
      } catch (e) {
        return res.status(HTTPStatus.BAD_REQUEST).json(e);
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },
  updateDevice: async (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        const device = await getModelByTenant(
          tenant.toLowerCase(),
          "device",
          DeviceSchema
        ).findById(req.params.id);
        if (!device.device.equals(req.device._id)) {
          return res.sendStatus(HTTPStatus.UNAUTHORIZED);
        }

        Object.keys(req.body).forEach((key) => {
          device[key] = req.body[key];
        });

        return res.status(HTTPStatus.OK).json(await device.save());
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  delete: async (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        const device = await getModelByTenant(
          tenant.toLowerCase(),
          "device",
          DeviceSchema
        ).findById(req.params.id);

        if (!device.device.equals(req.device._id)) {
          return res.sendStatus(HTTPStatus.UNAUTHORIZED);
        }

        await device.remove();
        return res.sendStatus(HTTPStatus.OK);
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  listOne: async (req, res) => {
    try {
      const { tenant } = req.query;
      if (tenant) {
        const device = await getModelByTenant(
          tenant.toLowerCase(),
          "device",
          DeviceSchema
        ).findById(req.params.id);
        return res.status(HTTPStatus.OK).json(device);
      } else {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "missing query params, please check documentation",
        });
      }
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  /**************************** using GCP **************************** */

  createOneGcp: (req, res) => {
    const formattedParent = client.registryPath(
      "airqo-250220",
      "europe-west1",
      "device-registry"
    );
    const device = {
      id: req.body.id,
      metadata: req.body.metadata,
    };
    const request = {
      parent: formattedParent,
      device: device,
    };
    client
      .createDevice(request)
      .then((responses) => {
        const response = responses[0];
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
    //connect the device to Cloud IoT core using MQTT bridge
  },

  listAllGcp: (req, res) => {
    const formattedParent = client.registryPath(
      "airqo-250220",
      "europe-west1",
      "device-registry"
    );
    const options = { autoPaginate: false };
    const callback = (responses) => {
      // The actual resources in a response.
      const resources = responses[0];
      // The next request if the response shows that there are more responses.
      const nextRequest = responses[1];
      // The actual response object, if necessary.
      // var rawResponse = responses[2];
      for (let i = 0; i < resources.length; i += 1) {
        // doThingsWith(resources[i]);
      }
      if (nextRequest) {
        // Fetch the next page.
        return client.listDeviceModels(nextRequest, options).then(callback);
      }
      let response = responses[0];
      return res.status(HTTPStatus.OK).json(response);
    };
    client
      .listDeviceModels({ parent: formattedParent }, options)
      .then(callback)
      .catch((err) => {
        console.error(err);
      });
  },

  createOne: async (req, res) => {
    try {
      const { tenant } = req.query;
      console.log("creating one device....");
      const device = await getModelByTenant(
        tenant.toLowerCase(),
        "device",
        DeviceSchema
      ).createDevice(req.body);
      return res.status(HTTPStatus.CREATED).json(device);
    } catch (e) {
      tryCatchErrors(res, e);
    }
  },

  listOneGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );
    client
      .getDevice({ name: formattedName })
      .then((responses) => {
        var response = responses[0];
        // doThingsWith(response)
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
      });
  },

  deleteGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );
    client
      .deleteDevice({ name: formattedName })
      .then((responses) => {
        let result = {
          status: "OK",
          message: `device ${device} has successfully been deleted`,
        };
        return res.status(HTTPStatus.OK).json(result);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
  },

  updateDeviceGcp: (req, res) => {
    let device = req.params.name;
    const formattedName = client.devicePath(
      "airqo-250220",
      "europe-west1",
      "device-registry",
      `${device}`
    );

    var deviceUpdate = {
      name: req.params.name,
      blocked: req.body.blocked,
      metadata: req.body.metadata,
    };
    var updateMask = {
      blocked: device.blocked,
      metadata: device.metadata,
    };
    var request = {
      device: deviceUpdate,
      updateMask: updateMask,
    };
    client
      .updateDevice(request)
      .then((responses) => {
        var response = responses[0];
        return res.status(HTTPStatus.OK).json(response);
      })
      .catch((err) => {
        console.error(err);
        return res.status(HTTPStatus.BAD_REQUEST).json(err);
      });
  },
};

module.exports = device;
