const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- common-util`);
const isEmpty = require("is-empty");
const AirQloudSchema = require("@models/Airqloud");
const SiteSchema = require("@models/Site");
const DeviceSchema = require("@models/Device");
const CohortSchema = require("@models/Cohort");
const GridSchema = require("@models/Grid");
const { getModelByTenant, getTenantDB, mongodb } = require("@config/database");
const distanceUtil = require("./distance");
const cryptoJS = require("crypto-js");
const { logObject, logText } = require("@utils/log");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const geolib = require("geolib");
const geohash = require("ngeohash");
const httpStatus = require("http-status");

const siteFieldsToExclude = constants.SITE_FIELDS_TO_EXCLUDE;
const deviceFieldsToExclude = constants.DEVICE_FIELDS_TO_EXCLUDE;

const sitesInclusionProjection = {
  name: 1,
  description: 1,
  sites: "$sites",
  "shape.type": 1,
  admin_level: 1,
};

const devicesInclusionProjection = {
  name: 1,
  description: 1,
  devices: "$devices",
};

const sitesExclusionProjection = siteFieldsToExclude.reduce(
  (projection, fieldName) => {
    projection[`sites.${fieldName}`] = 0;
    return projection;
  },
  {}
);

const devicesExclusionProjection = deviceFieldsToExclude.reduce(
  (projection, fieldName) => {
    projection[`devices.${fieldName}`] = 0;
    return projection;
  },
  {}
);

const devicesModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "device", DeviceSchema);
};

const sitesModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "site", SiteSchema);
};

const airqloudsModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "airqloud", AirQloudSchema);
};

const GridModel = (tenant) => {
  try {
    const grids = mongoose.model("grids");
    return grids;
  } catch (error) {
    // logObject("error", error);
    const grids = getModelByTenant(tenant, "grid", GridSchema);
    return grids;
  }
};

const CohortModel = (tenant) => {
  try {
    const cohorts = mongoose.model("cohorts");
    return cohorts;
  } catch (error) {
    const cohorts = getModelByTenant(tenant, "cohort", CohortSchema);
    return cohorts;
  }
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
        const filteredSites = map((site) => site._id);
        return {
          success: true,
          message,
          data: filteredSites,
          status: httpStatus.OK,
        };
      } else if (responseFromListAirQloud.success === false) {
        return responseFromListAirQloud;
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
          status: httpStatus.OK,
        };
      } else if (responseFromListSites.success === false) {
        return responseFromListSites;
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
            status: httpStatus.OK,
            data: count,
          });
        } else if (err) {
          callback({
            success: false,
            message: "Internal Server Error",
            errors: { message: err.message },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
          status: httpStatus.BAD_REQUEST,
          message: "the provided encrypted key is not recognizable",
          errors: { message: "the provided encrypted key is not recognizable" },
        };
      } else if (!isEmpty(originalText)) {
        return {
          success: true,
          message: "successfully decrypted the text",
          data: originalText,
          status: httpStatus.OK,
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  generateGeoHashFromCoordinates: (shape) => {
    try {
      logObject("shape", shape);
      const { coordinates, type } = shape;
      // Flatten the coordinates array to handle both Polygon and MultiPolygon

      if (type === "MultiPolygon") {
        logObject("coordinates.flat(2.1)", coordinates.flat(2));
        const flattenedMultiPolygonCoordinates = coordinates
          .flat(3)
          .map(([longitude, latitude]) => ({
            latitude,
            longitude,
          }));

        const centerPoint = geolib.getCenter(flattenedMultiPolygonCoordinates);
        // Generate the GeoHash using the center point
        const geoHash = geohash.encode(
          centerPoint.latitude,
          centerPoint.longitude
        );
        return geoHash;
      } else if (type === "Polygon") {
        logObject("coordinates.flat(2)", coordinates.flat(2));
        const flattenedPolygonCoordinates = coordinates
          .flat(2)
          .map(([longitude, latitude]) => ({
            latitude,
            longitude,
          }));

        const centerPoint = geolib.getCenter(flattenedPolygonCoordinates);
        // Generate the GeoHash using the center point
        const geoHash = geohash.encode(
          centerPoint.latitude,
          centerPoint.longitude
        );
        return geoHash;
      }
    } catch (error) {
      logObject("the error in the common util", error);
      logger.error(`Internal Server Error ---  ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  getDocumentsByNetworkId_v1: async (tenantId, network, category) => {
    try {
      let cohortsQuery = CohortModel(tenantId).find({
        network,
      });
      let gridsQuery = GridModel(tenantId).find({
        network,
      });

      if (category && category === "summary") {
        cohortsQuery = cohortsQuery.select("name description");
        gridsQuery = gridsQuery.select("name shape.type");
      }

      const cohorts = await cohortsQuery;
      const grids = await gridsQuery;
      return { cohorts, grids };
    } catch (error) {
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
        message: "Internal Server Error",
      };
    }
  },

  getDocumentsByNetworkId: async (tenantId, network, category) => {
    try {
      const cohortsQuery = CohortModel(tenantId).aggregate([
        {
          $match: { network },
        },
        {
          $lookup: {
            from: "devices",
            localField: "_id",
            foreignField: "cohorts",
            as: "devices",
          },
        },
        {
          $project: devicesInclusionProjection,
        },
        {
          $project: devicesExclusionProjection,
        },
      ]);

      const gridsQuery = GridModel(tenantId).aggregate([
        {
          $match: { network },
        },
        {
          $lookup: {
            from: "sites",
            localField: "_id",
            foreignField: "grids",
            as: "sites",
          },
        },
        {
          $project: sitesInclusionProjection,
        },

        {
          $project: sitesExclusionProjection,
        },
      ]);

      const [cohorts, grids] = await Promise.all([
        cohortsQuery.exec(),
        gridsQuery.exec(),
      ]);

      return { cohorts, grids };
    } catch (error) {
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
        message: "Internal Server Error",
      };
    }
  },
};

module.exports = common;
