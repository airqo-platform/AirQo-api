const Device = require("../models/Device");
const Maintenance = require("../models/maintenance_log");
const LocationActivity = require("../models/location_activity");
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

const doesDeviceExist = async (deviceName) => {
  try {
    logText(".......................................");
    logText("doesDeviceExist?...");
    const device = await Device.find({ name: deviceName }).exec();
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

const getChannelID = async (req, res, deviceName) => {
  try {
    logText("...................................");
    logText("getting channel ID...");
    const deviceDetails = await Device.find({ name: deviceName }).exec();
    logObject("the device details", deviceDetails);
    logElement("the channel ID", deviceDetails[0]._doc.channelID);
    let channeID = deviceDetails[0]._doc.channelID;
    return channeID;
  } catch (e) {
    return res.status(HTTPStatus.BAD_GATEWAY).json({
      success: false,
      message: "unable to get the corresponding TS ID",
      error: e.message,
    });
  }
};

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

const doesLocationExist = async (locationName) => {
  let location = await Location.find({ name: locationName }).exec();
  if (location) {
    return true;
  } else {
    return false;
  }
};

const getGpsCoordinates = async (locationName) => {
  logText("...................................");
  logText("Getting the GPS coordinates...");
  let location = await Location.find({ name: locationName }).exec();
  if (location) {
    const lat = `${location.latitude}`;
    const lon = `${location.longitude}`;
    if (lat && lon) {
      logText(
        "Successfully retrieved the GPS coordinates from the location..."
      );
      return { lat, lon };
    } else {
      logText("Unable to retrieve the GPS coordinates from location...");
    }
  } else {
    logText(`Unable to find location ${locationName}`);
  }
};

const isDeviceNotDeployed = async (deviceName) => {
  try {
    // const query = Device.find({ name: deviceName });
    // device = query.getFilter(); // `{ name: 'Jean-Luc Picard' }`

    const device = await Device.find({ name: deviceName }).exec();
    logText("....................");
    logText("checking isDeviceNotDeployed....");
    logObject("device is here", device[0]._doc);
    const isNotDeployed = isEmpty(device[0]._doc.locationID) ? true : false;
    logElement("locationID", device[0]._doc.locationID);
    logElement("isNotDeployed", isNotDeployed);
    return isNotDeployed;
  } catch (e) {
    logText("error", e);
  }
};

const isDeviceNotRecalled = async (deviceName) => {
  try {
    const device = await Device.find({ name: deviceName }).exec();
    logText("....................");
    logText("checking isDeviceNotRecalled....");
    logObject("device is here", device[0]._doc);
    const isNotRecalled = device[0]._doc.isActive == true ? true : false;
    logElement("isActive", device[0]._doc.isActive);
    logElement("isNotRecalled", isNotRecalled);
    return isNotRecalled;
  } catch (e) {
    logElement("error", e);
  }
};

function threeMonthsFromNow(date) {
  d = new Date(date);
  var targetMonth = d.getMonth() + 3;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const locationActivityRequestBodies = (req, res) => {
  try {
    const type = req.query.type;
    logText("....................");
    logText("locationActivityRequestBodies...");
    logElement("activityType", type);
    let locationActivityBody = {};
    let deviceBody = {};
    const {
      deviceName,
      locationName,
      height,
      mountType,
      powerType,
      description,
      latitude,
      longitude,
      date,
      tags,
      isPrimaryInLocation,
      isUserForCollocaton,
    } = req.body;

    //location and device body to be used for deploying....
    if (type == "deploy") {
      locationActivityBody = {
        location: locationName,
        device: deviceName,
        date: new Date(date),
        description: "device deployed",
        activityType: "deployment",
      };

      /**
       * in case we decide to use the location ID to get the latitude and longitude
       */
      // if (doesLocationExist(locationName)) {
      //   let { lat, lon } = getGpsCoordinates(locationName);
      //   deviceBody = {
      //     name: deviceName,
      //     locationID: locationName,
      //     height: height,
      //     mountType: mountType,
      //     powerType: powerType,
      //     isPrimaryInLocation: isPrimaryInLocation,
      //     isUserForCollocaton: isUserForCollocaton,
      //     nextMaintenance: threeMonthsFromNow(date),
      //     isActive: true,
      //     latitude: lat,
      //     longitude: lon,
      //   };
      // }
      // {
      //   res.status(500).json({
      //     message: "the location does not exist",
      //     success: false,
      //   });
      // }

      deviceBody = {
        name: deviceName,
        locationID: locationName,
        height: height,
        mountType: mountType,
        powerType: powerType,
        isPrimaryInLocation: isPrimaryInLocation,
        isUserForCollocaton: isUserForCollocaton,
        nextMaintenance: threeMonthsFromNow(date),
        isActive: true,
        latitude: latitude,
        longitude: longitude,
      };
      logObject("locationActivityBody", locationActivityBody);
      logObject("deviceBody", deviceBody);
      return { locationActivityBody, deviceBody };
    } else if (type == "recall") {
      /****** recalling bodies */
      locationActivityBody = {
        location: locationName,
        device: deviceName,
        date: new Date(date),
        description: "device recalled",
        activityType: "recallment",
      };
      deviceBody = {
        name: deviceName,
        locationID: "",
        height: "",
        mountType: "",
        powerType: "",
        isPrimaryInLocation: false,
        isUserForCollocaton: false,
        nextMaintenance: "",
        longitude: "",
        latitude: "",
        isActive: false,
      };
      logObject("locationActivityBody", locationActivityBody);
      logObject("deviceBody", deviceBody);
      return { locationActivityBody, deviceBody };
    } else if (type == "maintain") {
      /******** maintaining bodies */
      logObject("the tags", tags);
      locationActivityBody = {
        location: locationName,
        device: deviceName,
        date: new Date(date),
        description: description,
        activityType: "maintenance",
        nextMaintenance: threeMonthsFromNow(date),
        // $addToSet: { tags: { $each: tags } },
        tags: tags,
      };
      if (description == "preventive") {
        deviceBody = {
          name: deviceName,
          nextMaintenance: threeMonthsFromNow(date),
        };
      } else if (description == "corrective") {
        deviceBody = {
          name: deviceName,
        };
      }
      logObject("locationActivityBody", locationActivityBody);
      logObject("deviceBody", deviceBody);
      return { locationActivityBody, deviceBody };
    } else {
      /****incorrect query parameter....... */
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        message: "incorrect query parameter",
        success: false,
      });
    }
  } catch (e) {
    console.log("error" + e);
  }
};

const updateThingBodies = (req, res) => {
  let {
    name,
    latitude,
    longitude,
    description,
    public_flag,
    readKey,
    writeKey,
    mobility,
    height,
    mountType,
    visibility,
    ISP,
    phoneNumber,
    device_manufacturer,
    product_name,
    powerType,
    locationID,
    host,
    isPrimaryInLocation,
    isUsedForCollocation,
    nextMaintenance,
    channelID,
    isActive,
    tags,
    elevation,
  } = req.body;

  let deviceBody = {
    ...(!isEmpty(name) && { name: name }),
    ...(!isEmpty(readKey) && { readKey: readKey }),
    ...(!isEmpty(writeKey) && { writeKey: writeKey }),
    ...(!isEmpty(host) && { host: host }),
    ...(!isEmpty(isActive) && { isActive: isActive }),
    ...(!isEmpty(latitude) && { latitude: latitude }),
    ...(!isEmpty(longitude) && { longitude: longitude }),
    ...(!isEmpty(description) && { description: description }),
    ...(!isEmpty(visibility) && { visibility: visibility }),
    ...(!isEmpty(product_name) && { product_name: product_name }),
    ...(!isEmpty(powerType) && { powerType: powerType }),
    ...(!isEmpty(mountType) && { mountType: mountType }),
    ...(!isEmpty(device_manufacturer) && {
      device_manufacturer: device_manufacturer,
    }),
    ...(!isEmpty(phoneNumber) && { phoneNumber: phoneNumber }),
    ...(!isEmpty(channelID) && { channelID: channelID }),
    ...(!isEmpty(isPrimaryInLocation) && {
      isPrimaryInLocation: isPrimaryInLocation,
    }),
    ...(!isEmpty(isUsedForCollocation) && {
      isUsedForCollocation: isUsedForCollocation,
    }),
    ...(!isEmpty(ISP) && { ISP: ISP }),
    ...(!isEmpty(height) && { height: height }),
    ...(!isEmpty(mobility) && { mobility: mobility }),
    ...(!isEmpty(locationID) && { locationID: locationID }),
    ...(!isEmpty(nextMaintenance) && { nextMaintenance: nextMaintenance }),
  };

  let tsBody = {
    ...(!isEmpty(name) && { name: name }),
    ...(!isEmpty(elevation) && { elevation: elevation }),
    ...(!isEmpty(tags) && { tags: tags }),
    ...(!isEmpty(latitude) && { latitude: latitude }),
    ...(!isEmpty(longitude) && { longitude: longitude }),
    ...(!isEmpty(description) && { description: description }),
    ...(!isEmpty(visibility) && { public_flag: visibility }),
  };

  return { deviceBody, tsBody };
};

const clearEventsBody = () => {
  let eventsBody = {};

  return { eventsBody };
};

const doLocationActivity = async (
  res,
  deviceBody,
  activityBody,
  deviceName,
  type,
  deviceExists,
  isNotDeployed,
  isNotRecalled
) => {
  const deviceFilter = { name: deviceName };

  let check = "";
  if (type == "deploy") {
    check = isNotDeployed;
  } else if (type == "recall") {
    check = isNotRecalled;
  } else if (type == "maintain") {
    check = true;
  } else {
    check = false;
  }

  logText("....................");
  logText("doLocationActivity...");
  logText("activityType", type);
  logElement("deviceExists", isNotDeployed);
  logElement("isNotDeployed", isNotDeployed);
  logElement("isNotRecalled", isNotRecalled);
  logObject("activityBody", activityBody);
  logElement("check", check);
  logObject("deviceBody", deviceBody);

  logText("....................");

  if (check) {
    //first update device body
    await Device.findOneAndUpdate(
      deviceFilter,
      deviceBody,
      {
        new: true,
      },
      (error, updatedDevice) => {
        if (error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            message: `unable to ${type} `,
            error,
            success: false,
          });
        } else if (updatedDevice) {
          //then log the operation
          const log = LocationActivity.createLocationActivity(activityBody);
          log.then((log) => {
            return res.status(HTTPStatus.OK).json({
              message: `${type} successfully carried out`,
              updatedDevice,
              success: true,
            });
          });
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            message: `device does not exist, please first create the device you are trying to ${type} `,
            success: false,
          });
        }
      }
    );
  } else {
    return res.status(HTTPStatus.BAD_REQUEST).json({
      message: `The ${type} activity was already done for this device, please crosscheck `,
      success: false,
    });
  }
};

const device = {
  listAll: async (req, res) => {
    const limit = parseInt(req.query.limit, 0);
    const skip = parseInt(req.query.skip, 0);

    try {
      const devices = await Device.list({ limit, skip });
      return res.status(HTTPStatus.OK).json(devices);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  listAllByLocation: async (req, res) => {
    const location = req.query.loc;
    logElement("location ", location);
    try {
      const devices = await Device.find({ locationID: location }).exec();
      return res.status(HTTPStatus.OK).json(devices);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
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
        return client.listDevices(nextRequest, options).then(callback);
      }
      let response = responses[0];
      return res.status(HTTPStatus.OK).json(response);
    };
    client
      .listDevices({ parent: formattedParent }, options)
      .then(callback)
      .catch((err) => {
        console.error(err);
      });
  },

  createOne: async (req, res) => {
    try {
      console.log("creating one device....");
      const device = await Device.createDevice(req.body);
      return res.status(HTTPStatus.CREATED).json(device);
    } catch (e) {
      return res.status(400).json(e);
    }
  },

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

  /********************************* create Thing ****************************** */
  createThing: async (req, res) => {
    try {
      const baseUrl = constants.CREATE_THING_URL;
      let { name } = req.body;
      let { tsBody, deviceBody } = updateThingBodies(req, res);
      let prepBodyTS = {
        ...tsBody,
        ...constants.DEVICE_CREATION,
      };
      let isDevicePresent = await doesDeviceExist(name);
      logElement("isDevicePresent ?", isDevicePresent);
      if (!isDevicePresent) {
        logText("adding device on TS...");
        await axios
          .post(baseUrl, prepBodyTS)
          .then(async (response) => {
            logText("device successfully created on TS.");
            logObject("the response from TS", response);
            let writeKey = response.data.api_keys[0].write_flag
              ? response.data.api_keys[0].api_key
              : "";
            let readKey = !response.data.api_keys[1].write_flag
              ? response.data.api_keys[1].api_key
              : "";
            let prepBodyDevice = {
              ...deviceBody,
              channelID: `${response.data.id}`,
              writeKey: writeKey,
              readKey: readKey,
            };
            logText("adding the device in the DB...");
            const device = await Device.createDevice(prepBodyDevice);
            logElement("DB addition response", device);
            return res.status(HTTPStatus.CREATED).json({
              success: true,
              message: "successfully created the device",
              device,
            });
          })
          .catch((e) => {
            let errors = e.message;
            res.status(400).json({
              success: false,
              message:
                "unable to create the device, please crosscheck the validity of all your input values",
              errors,
            });
          });
      } else {
        res.status(400).json({
          success: false,
          message: `device "${name}" already exists!`,
        });
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "unable to create the device",
        error: e,
      });
    }
  },

  doActivity: async (req, res) => {
    const { deviceName } = req.body;
    const type = req.query.type;
    const deviceExists = await doesDeviceExist(deviceName);
    const isNotDeployed = await isDeviceNotDeployed(deviceName);
    const isNotRecalled = await isDeviceNotRecalled(deviceName);
    const { locationActivityBody, deviceBody } = locationActivityRequestBodies(
      req,
      res
    );

    doLocationActivity(
      res,
      deviceBody,
      locationActivityBody,
      deviceName,
      type,
      deviceExists,
      isNotDeployed,
      isNotRecalled
    );
  },

  fetchDeployments: async (req, res) => {
    const limit = parseInt(req.query.limit, 0);
    const skip = parseInt(req.query.skip, 0);

    try {
      const locationActivities = await LocationActivity.list({ limit, skip });
      return res.status(HTTPStatus.OK).json(locationActivities);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  /********************************* delete Thing ****************************** */
  deleteThing: async (req, res) => {
    try {
      const { device } = req.query;
      if (!device) {
        res.status(400).json({
          message:
            "please use the correct query parameter, check API documentation",
          success: false,
        });
      }
      if (doesDeviceExist(device)) {
        const channelID = await getChannelID(req, res, device);
        logText("deleting device from TS.......");
        logElement("the channel ID", channelID);
        await axios
          .delete(constants.DELETE_THING_URL(channelID))
          .then(async (response) => {
            logText("successfully deleted device from TS");
            logObject("TS response data", response.data);
            logText("deleting device from DB.......");
            const deviceRemovedFromDB = await Device.findOneAndRemove({
              name: device,
            }).exec();
            if (deviceRemovedFromDB) {
              let deviceDeleted = response.data;
              logText("successfully deleted device from DB");
              res.status(200).json({
                message: "successfully deleted the device from DB",
                success: true,
                deviceDeleted,
              });
            } else if (!deviceRemovedFromDB) {
              res.status(500).json({
                message: "unable to the device from DB",
                success: false,
                deviceDetails: device,
              });
            }
          })
          .catch(function(error) {
            logElement("unable to delete device from TS", error);
            res.status(500).json({
              message: "unable to delete the device from TS",
              success: false,
              error,
            });
          });
      } else {
        logText("device does not exist in DB");
        res.status(500).json({
          message: "device does not exist in DB",
          success: false,
        });
      }
    } catch (e) {
      logElement("unable to carry out the entire deletion of device", e);
      logObject("unable to carry out the entire deletion of device", e);
    }
  },

  /********************************* clear Thing ****************************** */
  clearThing: async (req, res) => {
    try {
      const { device } = req.query;
      if (!device) {
        res.status(400).json({
          message:
            "please use the correct query parameter, check API documentation",
          success: false,
        });
      }
      let isDevicePresent = await doesDeviceExist(device);
      logElement("isDevicePresent ?", isDevicePresent);
      if (isDevicePresent) {
        //get the thing's channel ID
        //lets first get the channel ID
        const channelID = await getChannelID(req, res, device);
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
    } catch (e) {
      logText(`unable to clear device ${device}`);
    }
  },

  /********************************* Update Thing Settings ****************************** */
  updateThingSettings: async (req, res) => {
    try {
      let { device } = req.query;
      if (!device) {
        res.status(400).json({
          message:
            "please use the correct query parameter, check API documentation",
          success: false,
        });
      }
      let isDevicePresent = await doesDeviceExist(device);
      logElement("isDevicePresent ?", isDevicePresent);

      if (isDevicePresent) {
        const channelID = await getChannelID(req, res, device);
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
          .put(constants.UPDATE_THING(channelID), qs.stringify(tsBody), config)
          .then(async (response) => {
            logText(`successfully updated device ${device} in TS`);
            logObject("response from TS", response.data);
            const updatedDevice = await Device.findOneAndUpdate(
              deviceFilter,
              deviceBody,
              {
                new: true,
              }
            );
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
            res.status(500).json({
              message: "unable to update the device settings in TS",
              success: false,
              error: error.message,
            });
          });
      } else {
        logText(`device ${device} does not exist in DB`);
        res.status(500).json({
          message: `device ${device} does not exist`,
          success: false,
        });
      }
    } catch (e) {
      logElement("unable to perform update operation", e);
      res.status(500).json({
        message: "unable to perform update operation",
        success: false,
        error: e,
      });
    }
  },

  /**************************** end of using ThingSpeak **************************** */

  //getting the device by its ID:
  listOne: async (req, res) => {
    try {
      const device = await Device.findById(req.params.id);
      return res.status(HTTPStatus.OK).json(device);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
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

  delete: async (req, res) => {
    try {
      const device = await Device.findById(req.params.id);

      if (!device.device.equals(req.device._id)) {
        return res.sendStatus(HTTPStatus.UNAUTHORIZED);
      }

      await device.remove();
      return res.sendStatus(HTTPStatus.OK);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
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

  updateDevice: async (req, res) => {
    try {
      const device = await Device.findById(req.params.id);
      if (!device.device.equals(req.device._id)) {
        return res.sendStatus(HTTPStatus.UNAUTHORIZED);
      }

      Object.keys(req.body).forEach((key) => {
        device[key] = req.body[key];
      });

      return res.status(HTTPStatus.OK).json(await device.save());
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
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
