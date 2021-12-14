const DeviceSchema = require("../models/Device");
const { getModelByTenant } = require("./multitenancy");
const SiteSchema = require("../models/Site");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const axios = require("axios");
const SiteActivitySchema = require("../models/SiteActivity");
const constants = require("../config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const {
  clearEventsBody,
  doesDeviceExist,
  updateThingBodies,
  threeMonthsFromNow,
  getChannelID,
  getApiKeys,
} = require("./does-device-exist");

const getDetail = require("./get-device-details");

const { kafkaProducer } = require("../config/kafka");
const log4js = require("log4js");
const logger = log4js.getLogger("site-activities-util");

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
        const payloads = [
          {
            topic: `gcp-${constants.ENV_ACRONYM}-createActivity-activities-0`,
            messages: JSON.stringify(createdActivity),
            partition: 0,
          },
        ];
        kafkaProducer.send(payloads, (err, data) => {
          logObject("Kafka producer data", data);
          logger.info(`Kafka producer data, ${data}`);
          logObject("Kafka producer error", err);
          logger.error(`Kafka producer error, ${err}`);
        });

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
      maintenanceType,
      site_id,
    } = req.body;

    if (type === "deploy") {
      /****** deploy bodies ******/
      let deployment_date = new Date(date);
      siteActivityBody = {
        device: deviceName || req.query.deviceName,
        date: (date && new Date(date)) || new Date(),
        description: "device deployed",
        activityType: "deployment",
        site_id: site_id,
      };

      deviceBody = {
        height: height,
        mountType: mountType,
        powerType: powerType,
        isPrimaryInLocation: isPrimaryInLocation,
        nextMaintenance: threeMonthsFromNow(date),
        isActive: true,
        latitude: latitude,
        longitude: longitude,
        site_id: site_id,
        deployment_date,
      };
      logObject("siteActivityBody", siteActivityBody);
      logObject("deviceBody", deviceBody);
      return { siteActivityBody, deviceBody };
    } else if (type === "recall") {
      /****** recalling bodies ******/
      let recall_date = new Date();
      siteActivityBody = {
        device: deviceName || req.query.deviceName,
        date: new Date(),
        description: "device recalled",
        activityType: "recallment",
        site_id: site_id,
      };
      deviceBody = {
        height: 0,
        mountType: "",
        powerType: "",
        isPrimaryInLocation: false,
        nextMaintenance: "",
        longitude: "",
        latitude: "",
        isActive: false,
        site_id: null,
        description: "",
        siteName: "",
        locationName: "",
        recall_date,
      };
      logObject("siteActivityBody", siteActivityBody);
      logObject("deviceBody", deviceBody);
      return { siteActivityBody, deviceBody };
    } else if (type === "maintain") {
      /******** maintaining bodies *************/
      let maintenance_date = date && new Date(date);
      logObject("the tags", tags);
      siteActivityBody = {
        site: siteName,
        site_id: site_id,
        device: deviceName || req.query.deviceName,
        date: (date && new Date(date)) || new Date(),
        description: description,
        activityType: "maintenance",
        nextMaintenance: threeMonthsFromNow(date),
        maintenanceType: maintenanceType,
        tags: tags,
      };
      deviceBody = {
        nextMaintenance: threeMonthsFromNow(date),
        maintenance_date,
      };

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
      ...(!isEmpty(tags) && { tags }),
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
  getGpsCoordinates,
  doesLocationExist,
  queryFilterOptions,
  bodyFilterOptions,
};
