const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const LocationSchema = require("../models/Location");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const axios = require("axios");
const LocationActivitySchema = require("../models/location_activity");
const constants = require("../config/constants");
const {
  clearEventsBody,
  doesDeviceExist,
  updateThingBodies,
  threeMonthsFromNow,
  getChannelID,
  getApiKeys,
} = require("./deviceControllerHelpers");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const getGpsCoordinates = async (locationName, tenant) => {
  logText("...................................");
  logText("Getting the GPS coordinates...");

  let location = await getModelByTenant(
    tenant.toLowerCase(),
    "location_registry",
    LocationSchema
  )
    .find({ name: locationName })
    .exec();
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
  try {
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
      await getModelByTenant(
        tenant.toLowerCase(),
        "device",
        DeviceSchema
      ).findOneAndUpdate(
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
            const log = getModelByTenant(
              tenant.toLowerCase(),
              "activity",
              LocationActivitySchema
            ).createLocationActivity(activityBody);
            log.then((log) => {
              return res.status(HTTPStatus.OK).json({
                message: `${type} successfully carried out`,
                activityBody,
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
  } catch (e) {
    logElement("error", e);
    return res.status(HTTPStatus.BAD_GATEWAY).json({
      message: `Server Error`,
      success: false,
    });
  }
};

const doesLocationExist = async (locationName, tenant) => {
  let location = await getModelByTenant(
    tenant.toLowerCase(),
    "location_registry",
    LocationSchema
  )
    .find({ name: locationName })
    .exec();
  if (location) {
    return true;
  } else {
    return false;
  }
};

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
        // location: locationName,
        device: deviceName,
        date: new Date(date),
        description: "device deployed",
        activityType: "deployment",
      };

      /**
       * in case we decide to use the location ID to get the latitude and longitude
       */
      // if (doesLocationExist(locationName, tenant)) {
      //   let { lat, lon } = getGpsCoordinates(locationName, tenant);
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
        // locationID: locationName,
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
        // location: locationName,
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

const isDeviceNotRecalled = async (deviceName, tenant) => {
  try {
    const device = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    )
      .find({ name: deviceName })
      .exec();
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

const isDeviceNotDeployed = async (deviceName, tenant) => {
  try {
    const device = await getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
    )
      .find({ name: deviceName })
      .exec();
    logText("....................");
    logText("checking isDeviceNotDeployed....");
    logObject("device is here", device[0]._doc);
    const isNotDeployed = device[0]._doc.isActive == false ? true : false;
    logElement("locationID", device[0]._doc.locationID);
    logElement("isNotDeployed", isNotDeployed);
    return isNotDeployed;
  } catch (e) {
    logText("error", e);
  }
};

const queryFilterOptions = async (req, res) => {
  try {
    const { location, type, device, next, id } = req.query;

    let activityFilter = {
      ...(!isEmpty(location) && { location: location }),
      ...(!isEmpty(type) && { type: type }),
      ...(!isEmpty(device) && { device: device }),
      ...(!isEmpty(next) && { next: next }),
      ...(!isEmpty(id) && { _id: id }),
      ...!isEmpty(),
    };
    return { activityFilter };
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

const bodyFilterOptions = async (req, res) => {
  try {
    const {
      location,
      device,
      date,
      description,
      activityType,
      nextMaintenance,
      tags,
    } = req.body;

    let activityBody = {
      ...(!isEmpty(location) && { location: location }),
      ...(!isEmpty(date) && { date: date }),
      ...(!isEmpty(device) && { device: device }),
      ...(!isEmpty(description) && { description: description }),
      ...(!isEmpty(activityType) && { activityType: activityType }),
      ...(!isEmpty(nextMaintenance) && { nextMaintenance: nextMaintenance }),
      ...(!isEmpty(tags) && { tags: tags }),
    };
    return { activityBody };
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

module.exports = {
  isDeviceNotDeployed,
  isDeviceNotRecalled,
  locationActivityRequestBodies,
  doLocationActivity,
  getGpsCoordinates,
  doesLocationExist,
  queryFilterOptions,
  bodyFilterOptions,
};
