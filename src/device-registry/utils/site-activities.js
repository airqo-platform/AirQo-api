const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const SiteSchema = require("../models/Site");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const SiteActivitySchema = require("../models/SiteActivity");
const { generateMonthsInfront } = require(".../date");
const { getDeviceDetailsOnPlatform } = require("./get-device-details");
const { tryCatchErrors } = require("./errors");

const carryOutActivity = async (
  res,
  tenant,
  deviceName,
  deviceBody,
  activityBody,
  options
) => {
  const deviceFilter = { name: deviceName };
  return getModelByTenant(
    tenant.toLowerCase(),
    "device",
    DeviceSchema
  ).findOneAndUpdate(
    deviceFilter,
    deviceBody,
    { new: true },
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
        let createdActivity = {};
        await getModelByTenant(
          tenant.toLowerCase(),
          "activity",
          SiteActivitySchema
        )
          .createLocationActivity(activityBody)
          .then((log) => (createdActivity = log));

        return res.status(HTTPStatus.OK).json({
          message:
            (options && options.successMsg) ||
            "Operation successfully carried out",
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
};

const siteActivityRequestBodies = (req, res) => {
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
      isUsedForCollocation,
      maintenanceType,
    } = req.body;

    if (type === "deploy") {
      /****** deploy bodies ******/
      siteActivityBody = {
        device: deviceName || req.query.deviceName,
        date: (date && new Date(date)) || new Date(),
        description: "device deployed",
        activityType: "deployment",
      };

      deviceBody = {
        height: height,
        mountType: mountType,
        powerType: powerType,
        isPrimaryInLocation: isPrimaryInLocation,
        isUsedForCollocaton: isUsedForCollocaton,
        nextMaintenance: generateMonthsInfront(date, 3),
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
        device: deviceName || req.query.deviceName,
        date: new Date(),
        description: "device recalled",
        activityType: "recallment",
      };
      deviceBody = {
        height: 0,
        mountType: "",
        powerType: "",
        isPrimaryInLocation: false,
        isUsedForCollocation: false,
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
        device: deviceName || req.query.deviceName,
        date: (date && new Date(date)) || new Date(),
        description: description,
        activityType: "maintenance",
        nextMaintenance: generateMonthsInfront(date, 3),
        maintenanceType: maintenanceType,
        tags: tags,
      };
      if (maintenanceType == "preventive") {
        deviceBody = {
          name: deviceName,
          nextMaintenance: generateMonthsInfront(date, 3),
        };
      } else if (maintenanceType == "corrective") {
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
    let device = await getDeviceDetailsOnPlatform(tenant, name);
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
    let device = await getDeviceDetailsOnPlatform(tenant, name);
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
  queryFilterOptions,
  bodyFilterOptions,
};
