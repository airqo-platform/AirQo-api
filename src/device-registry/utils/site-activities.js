const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const SiteSchema = require("../models/Site");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const axios = require("axios");
const SiteActivitySchema = require("../models/SiteActivity");
const constants = require("../config/constants");
const {
  clearEventsBody,
  doesDeviceExist,
  updateThingBodies,
  threeMonthsFromNow,
  getChannelID,
  getApiKeys,
} = require("./does-device-exist");

const jsonify = require("./jsonify");

const getDetail = require("./get-device-details");

const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("./errors");

const getGpsCoordinates = async (locationName, tenant) => {
  logText("...................................");
  logText("Getting the GPS coordinates...");

  let location = await getModelByTenant(
    tenant.toLowerCase(),
    "location_registry",
    SiteSchema
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


const carryOutActivity = async (res, tenant, deviceName, deviceBody, activityBody, options) => {
  const deviceFilter = { name: deviceName };
  return getModelByTenant(
      tenant.toLowerCase(),
      "device",
      DeviceSchema
  ).findOneAndUpdate(
      deviceFilter,
      deviceBody,
      {new: true},
       async (error, updatedDevice) => {
          if (error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              message: (options && options.errorMsg) || "Operation failed",
              error,
              success: false,
            });
          }

          if (updatedDevice) {
            //then log the operation
            let createdActivity = {}
            await getModelByTenant(
              tenant.toLowerCase(),
              "activity",
              SiteActivitySchema
            ).createLocationActivity(activityBody)
            .then(log => createdActivity = log);

            return res.status(HTTPStatus.OK).json({
                message: (options && options.successMsg) || "Operation successfully carried out",
                createdActivity,
                updatedDevice,
                success: true,
              });
          }
          return res.status(HTTPStatus.NOT_FOUND).json({
            message: `device does not exist, please first create the device`,
            success: false,
          });

        }
  );

}

const doLocationActivity = async (
  res,
  deviceBody,
  activityBody,
  deviceName,
  type,
  deviceExists,
  isDeployed,
  isRecalled,
  tenant
) => {
  try {
    const deviceFilter = { name: deviceName };
    logElement("isRecalled", isRecalled);
    logElement("isDeployed", isDeployed);

    let check = "";
    if (type.toLowerCase() == "deploy") {
      check = isRecalled;
    } else if (type.toLowerCase() == "recall") {
      check = isDeployed;
    } else if (type.toLowerCase() == "maintain") {
      check = true;
    } else {
      check = false;
    }

    logText("....................");
    logText("doLocationActivity...");
    logText("activityType", type);
    logElement("deviceExists", deviceExists);
    logElement("isDeployed", isDeployed);
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
            const activityLog = getModelByTenant(
              tenant.toLowerCase(),
              "activity",
              SiteActivitySchema
            ).createLocationActivity(activityBody);
            activityLog.then((activityLog) => {
              return res.status(HTTPStatus.OK).json({
                message: `${type} successfully carried out`,
                activityLog,
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
    SiteSchema
  )
    .find({ name: locationName })
    .exec();
  if (location) {
    return true;
  } else {
    return false;
  }
};

const siteActivityRequestBodies = (req, res, type = null) => {
  try {
    type = req.query.type || type;
    logText("....................");
    logText("siteActivityRequestBodies...");
    logElement("activityType", type);
    let siteActivityBody = {};
    let deviceBody = {};
    const {
      deviceName,
      siteName,
      height,
      mountType,
      powerType,
      description,
      latitude,
      longitude,
      date,
      tags,
      isPrimaryInLocation,
      isUsedForCollocaton,
      maintenanceType,
    } = req.body;

    if (type === "deploy") {
      /****** deploy bodies ******/
      siteActivityBody = {
        device: deviceName,
        date: new Date(date),
        description: "device deployed",
        activityType: "deployment",
      };

      deviceBody = {
        name: deviceName,
        height: height,
        mountType: mountType,
        powerType: powerType,
        isPrimaryInLocation: isPrimaryInLocation,
        isUsedForCollocaton: isUsedForCollocaton,
        nextMaintenance: threeMonthsFromNow(date),
        isActive: true,
        latitude: latitude,
        longitude: longitude,
      };
      logObject("siteActivityBody", siteActivityBody);
      logObject("deviceBody", deviceBody);
      return { siteActivityBody, deviceBody };
    } else if (type === "recall") {
      /****** recalling bodies ******/
      siteActivityBody = {
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
        isUsedForCollocaton: false,
        nextMaintenance: "",
        longitude: "",
        latitude: "",
        isActive: false,
      };
      logObject("siteActivityBody", siteActivityBody);
      logObject("deviceBody", deviceBody);
      return { siteActivityBody, deviceBody };
    } else if (type === "maintain") {
      /******** maintaining bodies *************/
      logObject("the tags", tags);
      siteActivityBody = {
        site: siteName,
        device: deviceName,
        date: new Date(date),
        description: description,
        activityType: "maintenance",
        nextMaintenance: threeMonthsFromNow(date),
        maintenanceType: maintenanceType,
        // $addToSet: { tags: { $each: tags } },
        tags: tags,
      };
      if (maintenanceType === "preventive") {
        deviceBody = {
          name: deviceName,
          nextMaintenance: threeMonthsFromNow(date),
        };
      } else if (maintenanceType === "corrective") {
        deviceBody = {
          name: deviceName,
        };
      }
      logObject("siteActivityBody", siteActivityBody);
      logObject("deviceBody", deviceBody);
      return { siteActivityBody, deviceBody };
    } else {
      /****incorrect query parameter....... */
      return res.status(HTTPStatus.BAD_REQUEST).json({
        message: "incorrect query parameter",
        success: false,
      });
    }
  } catch (e) {
    logElement("error", e);
  }
};

const isDeviceRecalled = async (name, tenant) => {
  try {
    logText("....................");
    logText("checking isDeviceRecalled....");
    let device = await getDetail(tenant, name);
    logObject("device", device);
    const isRecalled = !device[0].isActive;
    logElement("locationName", device[0].locationName);
    logElement("isRecalled", isRecalled);
    return isRecalled;
  } catch (e) {
    logText("error", e);
  }
};

const isDeviceDeployed = async (name, tenant) => {
  try {
    logText("....................");
    logText("checking isDeviceNotDeployed....");
    let device = await getDetail(tenant, name);
    logObject("device", device);
    const isDeployed = device[0].isActive;
    logElement("locationName", device[0].locationName);
    logElement("isDeployed", isDeployed);
    return isDeployed;
  } catch (e) {
    logText("error", e);
  }
};

const queryFilterOptions = async (req, res) => {
  try {
    const { location, type, device, next, id } = req.query;

    let filter = {
      ...(!isEmpty(location) && { location: location }),
      ...(!isEmpty(type) && { type: type }),
      ...(!isEmpty(device) && { device: device }),
      ...(!isEmpty(next) && { next: next }),
      ...(!isEmpty(id) && { _id: id }),
      ...!isEmpty(),
    };
    return { filter };
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
      maintenanceType,
    } = req.body;

    let activityBody = {
      ...(!isEmpty(location) && { location }),
      ...(!isEmpty(date) && { date }),
      ...(!isEmpty(device) && { device }),
      ...(!isEmpty(description) && { description }),
      ...(!isEmpty(activityType) && { activityType }),
      ...(!isEmpty(nextMaintenance) && { nextMaintenance }),
      ...(!isEmpty(maintenanceType) && { maintenanceType }),
      ...(!isEmpty(tags) && { tags: tags }),
    };
    return { activityBody };
  } catch (e) {
    tryCatchErrors(res, e);
  }
};

module.exports = {
  carryOutActivity,
  isDeviceDeployed,
  isDeviceRecalled,
  siteActivityRequestBodies,
  doLocationActivity,
  getGpsCoordinates,
  doesLocationExist,
  queryFilterOptions,
  bodyFilterOptions,
};
