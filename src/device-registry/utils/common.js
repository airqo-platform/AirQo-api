const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- common-util`);
const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const AirQloudSchema = require("@models/Airqloud");
const SiteSchema = require("@models/Site");
const DeviceSchema = require("@models/Device");
const { getModelByTenant } = require("@config/database");
const distanceUtil = require("./distance");
const cryptoJS = require("crypto-js");
const { logObject } = require("./log");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const devicesModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "device", DeviceSchema);
};

const sitesModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "site", SiteSchema);
};

const airqloudsModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "airqloud", AirQloudSchema);
};

const common = {
  getSitesFromAirQloud: async ({ tenant = "airqo", airqloudId } = {}) => {
    try {
      const filter = { _id: ObjectId(airqloudId) };
      let sites = [];
      const responseFromListAirQloud = await airqloudsModel(tenant).list({
        filter,
      });

      if (responseFromListAirQloud.success === true) {
        let message = "successfully retrieved the associated Sites";
        if (
          responseFromListAirQloud.data.length > 1 ||
          isEmpty(responseFromListAirQloud.data[0])
        ) {
          message = "No distinct AirQloud found in this search";
        } else if (!isEmpty(responseFromListAirQloud.data[0].sites)) {
          message = "Successfully retrieved the sites for this AirQloud";
          sites = responseFromListAirQloud.data[0].sites;
        } else {
          message =
            "Unable to find any sites associated with the provided AirQloud ID";
        }
        const filteredSites = sites.map((site) => site._id);
        return {
          success: true,
          message,
          data: filteredSites,
          status: HTTPStatus.OK,
        };
      } else if (responseFromListAirQloud.success === false) {
        return responseFromListAirQloud;
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  getSitesFromLatitudeAndLongitude: async ({
    tenant = "airqo",
    latitude,
    longitude,
    radius = constants.DEFAULT_NEAREST_SITE_RADIUS,
  } = {}) => {
    try {
      const responseFromListSites = await sitesModel(tenant).list();
      if (responseFromListSites.success === true) {
        let message = "successfully retrieved the nearest sites";
        const sites = responseFromListSites.data;
        const nearestSites = distanceUtil.filterSitesByRadius({
          sites,
          lat: latitude,
          lon: longitude,
          radius,
        });
        logObject("nearestSites", nearestSites);
        const siteIds = nearestSites.map((site) => site._id);
        if (isEmpty(siteIds)) {
          message = `No Site is within a ${constants.DEFAULT_NEAREST_SITE_RADIUS} KM radius to the provided coordinates`;
        }
        return {
          success: true,
          data: siteIds,
          message,
          status: HTTPStatus.OK,
        };
      } else if (responseFromListSites.success === false) {
        return responseFromListSites;
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  listDevices: async ({
    tenant = "airqo",
    filter = {},
    skip = 0,
    limit = 1000,
  } = {}) => {
    try {
      const responseFromListDevice = await devicesModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListDevice;
    } catch (e) {
      logger.error(`error for list devices util -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  getDevicesCount: async ({ tenant = "airqo", callback } = {}) => {
    try {
      await devicesModel(tenant).countDocuments({}, (err, count) => {
        if (count) {
          callback({
            success: true,
            message: "retrieved the number of devices",
            status: HTTPStatus.OK,
            data: count,
          });
        } else if (err) {
          callback({
            success: false,
            message: "Internal Server Error",
            errors: { message: err.message },
            status: HTTPStatus.INTERNAL_SERVER_ERROR,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
  decryptKey: async ({ encryptedKey } = {}) => {
    try {
      const bytes = cryptoJS.AES.decrypt(
        encryptedKey,
        constants.KEY_ENCRYPTION_KEY
      );
      const originalText = bytes.toString(cryptoJS.enc.Utf8);
      if (isEmpty(originalText)) {
        return {
          success: false,
          status: HTTPStatus.BAD_REQUEST,
          message: "the provided encrypted key is not recognizable",
          errors: { message: "the provided encrypted key is not recognizable" },
        };
      } else if (!isEmpty(originalText)) {
        return {
          success: true,
          message: "successfully decrypted the text",
          data: originalText,
          status: HTTPStatus.OK,
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = common;
