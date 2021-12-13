const SiteSchema = require("../models/Site");
const DeviceSchema = require("../models/Device");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const axios = require("axios");
const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});
const axiosInstance = () => {
  return axios.create();
};
const generateFilter = require("./generate-filter");

const SiteModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "site", SiteSchema);
};

const DeviceModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "device", DeviceSchema);
};

const manageSite = {
  deploy: (req) => {
    /**
     *   deploymentFields: [
    "height",
    "mountType",
    "powerType",
    "date",
    "latitude",
    "longitude",
    "site_id",
    "isPrimaryInLocation",
    "isUsedForCollocation",
  ]

  Here, we get the GPS coordinates from the site to 
  which were are deploying the device

  Afterwards, we update the Activity log accordingly.
     siteActivityBody = {
        device: deviceName || req.query.deviceName,
        date: (date && new Date(date)) || new Date(),
        description: "device deployed",
        activityType: "deployment",
      };

  We also update the Device details accordingly
   deviceBody = {
        height: height,
        mountType: mountType,
        powerType: powerType,
        isPrimaryInLocation: isPrimaryInLocation,
        isUsedForCollocation: isUsedForCollocation,
        nextMaintenance: threeMonthsFromNow(date),
        isActive: true,
        latitude: latitude,
        longitude: longitude,
        site_id: site_id,
      };
     */
  },

  recall: () => {
    /***
       * 
       * 
       * the Activity Body
       *     siteActivityBody = {
        device: deviceName || req.query.deviceName,
        date: new Date(),
        description: "device recalled",
        activityType: "recallment",
      };

      the Device Body
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
        site_id: "",
      };
       * 
       */
  },

  maintain: () => {
    /**
       * Activity Body
       *    siteActivityBody = {
        site: siteName,
        device: deviceName || req.query.deviceName,
        date: (date && new Date(date)) || new Date(),
        description: description,
        activityType: "maintenance",
        nextMaintenance: threeMonthsFromNow(date),
        maintenanceType: maintenanceType,
        tags: tags,
      };

      The device body
       deviceBody = {
        nextMaintenance: threeMonthsFromNow(date),
      };
       * 
       * 
       */
  },

  isDeviceActive: () => {
    /**
     *
     monitor the isActiveField of the device and 
     return the response accordingly
     */
  },

  generateSiteActivityRequestBodies: (req) => {
    /**
     * the date for next maintenance will be
     * fetched from a document
     */
  },

  list: () => {
    /**
     * list the site activities accordingly
     */
  },

  update: () => {
    /**
     * update the site activities accordingly
     */
  },

  delete: () => {
    /**
     * delete the site activities accordingly
     */
  },
};

module.export = manageSite;
