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
const { getModelByTenant } = require("../utils/multitenancy");
const {
  createOnThingSpeak,
  createOnClarity,
} = require("../utils/integrations");

const ComponentModel = (tenant) => {
  getModelByTenant(tenant, "component", ComponentSchema);
};
const DeviceModel = (tenant) => {
  getModelByTenant(tenant, "device", DeviceSchema);
};
const EventModel = (tenant) => {
  getModelByTenant(tenant, "event", EventSchema);
};
const LocationActivityModel = (tenant) => {
  getModelByTenant(tenant, "activity", LocationActivitySchema);
};

const doesDeviceExist = async (deviceName, tenant) => {
  try {
    logText(".......................................");
    logText("doesDeviceExist?...");
    const device = await getModelByTenant(tenant, "device", DeviceSchema)
      .find({ name: deviceName })
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

const getChannelID = async (req, res, deviceName, tenant) => {
  try {
    logText("...................................");
    logText("getting channel ID...");
    const deviceDetails = await getModelByTenant(tenant, "device", DeviceSchema)
      .find({ name: deviceName })
      .exec();
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

const getApiKeys = async (deviceName, tenant) => {
  logText("...................................");
  logText("getting api keys...");
  const deviceDetails = await getModelByTenant(tenant, "device", DeviceSchema)
    .find({ name: deviceName })
    .exec();
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

const isDeviceModelNotDeployed = async (deviceName, tenant) => {
  try {
    // const query = DeviceModel.find({ name: deviceName });
    // device = query.getFilter(); // `{ name: 'Jean-Luc Picard' }`

    const device = await getModelByTenant(tenant, "device", DeviceSchema)
      .find({ name: deviceName })
      .exec();
    logText("....................");
    logText("checking isDeviceModelNotDeployed....");
    logObject("device is here", device[0]._doc);
    const isNotDeployed = isEmpty(device[0]._doc.locationID) ? true : false;
    logElement("locationID", device[0]._doc.locationID);
    logElement("isNotDeployed", isNotDeployed);
    return isNotDeployed;
  } catch (e) {
    logText("error", e);
  }
};

const isDeviceModelNotRecalled = async (deviceName, tenant) => {
  try {
    const device = await getModelByTenant(tenant, "device", DeviceSchema)
      .find({ name: deviceName })
      .exec();
    logText("....................");
    logText("checking isDeviceModelNotRecalled....");
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
  isNotRecalled,
  tenant
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
    await getModelByTenant(tenant, "device", DeviceSchema).findOneAndUpdate(
      deviceFilter,
      deviceBody,
      {
        new: true,
      },
      (error, updatedDeviceModel) => {
        if (error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            message: `unable to ${type} `,
            error,
            success: false,
          });
        } else if (updatedDeviceModel) {
          //then log the operation
          const log = getModelByTenant(
            tenant,
            "activity",
            LocationActivitySchema
          ).createLocationActivity(activityBody);
          log.then((log) => {
            return res.status(HTTPStatus.OK).json({
              message: `${type} successfully carried out`,
              updatedDeviceModel,
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
    try {
      //..
      logText(".....................................");
      logText("list all devices by tenant...");
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      const { tenant, name, chid } = req.query;
      logElement("the channel ID", chid);
      logElement("the device name", name);
      if (tenant && name && !chid) {
        logElement("the tenant", tenant);
        logElement("the name", name);
        const device = await getModelByTenant(
          tenant,
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
          tenant,
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
            message: `this organisation (${tenant}) does not have this device or they do not exist, please crosscheck`,
          });
        }
      } else if (tenant && !name && !chid) {
        // const devices = await DeviceModel(tenant).list({ limit, skip });
        // return res.status(HTTPStatus.OK).json(devices);
        const devices = await getModelByTenant(
          tenant,
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
            message: `this organisation (${tenant}) does not have devices or it does not exist, please crosscheck`,
          });
        }
      } else {
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message:
            "request is missing the required query params, please crosscheck",
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message: "A bad request has been made, please crosscheck",
        error: e.message,
      });
    }
  },

  listAllByLocation: async (req, res) => {
    const { tenant, loc } = req.query;
    logElement("location ", loc);
    try {
      const devices = await getModelByTenant(tenant, "device", DeviceSchema)
        .find({ locationID: loc })
        .exec();
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
        tenant,
        "device",
        DeviceSchema
      ).createDevice(req.body);
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
      const { tenant } = req.query;
      if (tenant) {
        const baseUrl = constants.CREATE_THING_URL;
        let { name } = req.body;
        let { tsBody, deviceBody } = updateThingBodies(req, res);
        let prepBodyTS = {
          ...tsBody,
          ...constants.DEVICE_CREATION,
        };
        let isDeviceModelPresent = await doesDeviceExist(name, tenant);
        logElement("isDeviceModelPresent ?", isDeviceModelPresent);
        if (!isDeviceModelPresent) {
          /***
           * when creating for AirQo, make call to TS
           * As for other organisations, just make a different call or just ignore
           * will put this function in a separate place as a util of sorts
           */
          logText("adding device on TS...");
          let channel;
          if (tenant === "airqo") {
            createOnThingSpeak(
              req,
              res,
              baseUrl,
              prepBodyTS,
              channel,
              device,
              deviceBody,
              tenant
            );
          } else {
            //just create the device locally
            createOnClarity(tenant, req, res);
          }
        } else {
          res.status(400).json({
            success: false,
            message: `device "${name}" already exists!`,
          });
        }
      } else {
        //missing params
        return res.status(HTTPStatus.BAD_GATEWAY).json({
          success: false,
          message:
            "request is missing the required query params, please crosscheck",
        });
      }
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: "unable to create the device",
        error: e.message,
      });
    }
  },

  doActivity: async (req, res) => {
    const { deviceName } = req.body;
    const { type, tenant } = req.query;
    const deviceExists = await doesDeviceExist(deviceName, tenant);
    const isNotDeployed = await isDeviceModelNotDeployed(deviceName, tenant);
    const isNotRecalled = await isDeviceModelNotRecalled(deviceName, tenant);
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
      isNotRecalled,
      tenant
    );
  },

  fetchDeployments: async (req, res) => {
    const limit = parseInt(req.query.limit, 0);
    const skip = parseInt(req.query.skip, 0);

    try {
      const locationActivities = await getModelByTenant(
        tenant,
        "activity",
        LocationActivitySchema
      ).list({
        limit,
        skip,
      });
      return res.status(HTTPStatus.OK).json(locationActivities);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  /********************************* delete Thing ****************************** */
  deleteThing: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      if (!device) {
        res.status(400).json({
          message:
            "please use the correct query parameter, check API documentation",
          success: false,
        });
      }
      if (doesDeviceExist(device)) {
        const channelID = await getChannelID(req, res, device, tenant);
        logText("deleting device from TS.......");
        logElement("the channel ID", channelID);
        await axios
          .delete(constants.DELETE_THING_URL(channelID))
          .then(async (response) => {
            logText("successfully deleted device from TS");
            logObject("TS response data", response.data);
            logText("deleting device from DB.......");
            const deviceRemovedFromDB = await getModelByTenant(
              tenant,
              "device",
              DeviceSchema
            )
              .findOneAndRemove({
                name: device,
              })
              .exec();
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
      logElement(
        "unable to carry out the entire deletion of device",
        e.message
      );
      logObject("unable to carry out the entire deletion of device", e.message);
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
    }
  },

  /********************************* clear Thing ****************************** */
  clearThing: async (req, res) => {
    try {
      const { device, tenant } = req.query;
      if (!device) {
        res.status(400).json({
          message:
            "please use the correct query parameter, check API documentation",
          success: false,
        });
      }
      let isDeviceModelPresent = await doesDeviceExist(device);
      logElement("isDeviceModelPresent ?", isDeviceModelPresent);
      if (isDeviceModelPresent) {
        //get the thing's channel ID
        //lets first get the channel ID
        const channelID = await getChannelID(req, res, device, tenant);
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
              updatedDeviceModel,
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
      let { device, tenant } = req.query;
      if (!device) {
        res.status(400).json({
          message:
            "please use the correct query parameter, check API documentation",
          success: false,
        });
      }
      let isDeviceModelPresent = await doesDeviceExist(device);
      logElement("isDeviceModelPresent ?", isDeviceModelPresent);

      if (isDeviceModelPresent) {
        const channelID = await getChannelID(req, res, device, tenant);
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
            const updatedDeviceModel = await getModelByTenant(
              tenant,
              "device",
              DeviceSchema
            ).findOneAndUpdate(deviceFilter, deviceBody, {
              new: true,
            });
            if (updatedDeviceModel) {
              return res.status(HTTPStatus.OK).json({
                message: "successfully updated the device settings in DB",
                updatedDeviceModel,
                success: true,
              });
            } else if (!updatedDeviceModel) {
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
      const { tenant } = req.query;
      const device = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).findById(req.params.id);
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
      const { tenant } = req.query;
      const device = await getModelByTenant(
        tenant,
        "device",
        DeviceSchema
      ).findById(req.params.id);

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
      const { tenant } = req.query;
      const device = await getModelByTenant(
        tenant,
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
