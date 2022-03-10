const AirQloudSchema = require("../models/Airqloud");
const SiteSchema = require("../models/Site");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const jsonify = require("./jsonify");
const axios = require("axios");
const HTTPStatus = require("http-status");
const axiosInstance = () => {
  return axios.create();
};
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger("create-airqloud-util");
const createLocationUtil = require("./create-location");
const createSiteUtil = require("./create-site");
const geolib = require("geolib");
const httpStatus = require("http-status");

const createAirqloud = {
  initialIsCapital: (word) => {
    return word[0] !== word[0].toLowerCase();
  },
  hasNoWhiteSpace: (word) => {
    try {
      const hasWhiteSpace = word.indexOf(" ") >= 0;
      return !hasWhiteSpace;
    } catch (e) {
      logger.error(
        `create AirQloud util server error -- hasNoWhiteSpace -- ${e.message}`
      );
    }
  },

  retrieveCoordinates: async (request, entity) => {
    try {
      let entityInstance = {};
      if (entity === "location") {
        entityInstance = createLocationUtil;
      } else if (entity === "airqloud") {
        entityInstance = createAirqloud;
      }

      const responseFromListAirQloud = await entityInstance.list(request);

      if (responseFromListAirQloud.success === true) {
        if (isEmpty(responseFromListAirQloud.data)) {
          return {
            success: false,
            message: "unable to retrieve location details",
            status: HTTPStatus.NOT_FOUND,
            errors: {
              message: "no record exists for this location_id",
            },
          };
        }
        if (responseFromListAirQloud.data.length === 1) {
          const data = responseFromListAirQloud.data[0];
          return {
            data: data.location,
            success: true,
            message: "retrieved the location",
            status: HTTPStatus.OK,
          };
        }
        if (responseFromListAirQloud.data.length > 1) {
          return {
            success: false,
            message: "unable to retrieve location details",
            status: HTTPStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message: "requested for one record but received many",
            },
          };
        }
      }

      if (responseFromListAirQloud.success === false) {
        return {
          success: false,
          message: "unable to retrieve details from the provided location_id",
          errors: responseFromListAirQloud.errors,
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { location_id } = body;
      logObject("body", body);
      let modifiedBody = body;
      if (!isEmpty(location_id)) {
        let requestForCoordinateRetrieval = {};
        requestForCoordinateRetrieval["query"] = {};
        requestForCoordinateRetrieval["query"]["id"] = body.location_id;
        requestForCoordinateRetrieval["query"]["tenant"] = tenant;

        let responseFromRetrieveCoordinates = await createAirqloud.retrieveCoordinates(
          requestForCoordinateRetrieval,
          "location"
        );

        if (responseFromRetrieveCoordinates.success === true) {
          modifiedBody["location"] = responseFromRetrieveCoordinates.data;
        }
        if (responseFromRetrieveCoordinates.success === false) {
          return responseFromRetrieveCoordinates;
        }
      }

      let requestForCalucaltionAirQloudCenter = {};
      requestForCalucaltionAirQloudCenter["body"] = {};
      requestForCalucaltionAirQloudCenter["query"] = {};
      requestForCalucaltionAirQloudCenter["body"]["coordinates"] =
        modifiedBody.location.coordinates[0];

      const responseFromCalculateGeographicalCenter = await createAirqloud.calculateGeographicalCenter(
        requestForCalucaltionAirQloudCenter
      );
      logObject(
        "responseFromCalculateGeographicalCenter",
        responseFromCalculateGeographicalCenter
      );
      if (responseFromCalculateGeographicalCenter.success === true) {
        modifiedBody["center_point"] =
          responseFromCalculateGeographicalCenter.data;
      } else if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      }

      const responseFromRegisterAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).register(modifiedBody);

      logObject("responseFromRegisterAirQloud", responseFromRegisterAirQloud);

      if (responseFromRegisterAirQloud.success === true) {
        let status = responseFromRegisterAirQloud.status
          ? responseFromRegisterAirQloud.status
          : "";
        return {
          success: true,
          message: responseFromRegisterAirQloud.message,
          data: responseFromRegisterAirQloud.data,
          status,
        };
      } else if (responseFromRegisterAirQloud.success === false) {
        let errors = responseFromRegisterAirQloud.errors
          ? responseFromRegisterAirQloud.errors
          : "";

        let status = responseFromRegisterAirQloud.status
          ? responseFromRegisterAirQloud.status
          : "";

        return {
          success: false,
          message: responseFromRegisterAirQloud.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement(" the util server error,", err.message);
      return {
        success: false,
        message: "unable to create airqloud",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: err.message },
      };
    }
  },
  update: async (request) => {
    try {
      let { query, body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.airqlouds(request);

      let responseFromModifyAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyAirQloud.success === true) {
        let status = responseFromModifyAirQloud.status
          ? responseFromModifyAirQloud.status
          : "";
        return {
          success: true,
          message: responseFromModifyAirQloud.message,
          data: responseFromModifyAirQloud.data,
          status,
        };
      }

      if (responseFromModifyAirQloud.success === false) {
        let errors = responseFromModifyAirQloud.errors
          ? responseFromModifyAirQloud.errors
          : "";

        let status = responseFromModifyAirQloud.status
          ? responseFromModifyAirQloud.status
          : "";

        return {
          success: false,
          message: responseFromModifyAirQloud.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("update AirQlouds util", err.message);
      return {
        success: false,
        message: "unable to update airqloud",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.airqlouds(request);
      let responseFromRemoveAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).remove({
        filter,
      });

      if (responseFromRemoveAirQloud.success === true) {
        let status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : "";
        return {
          success: true,
          message: responseFromRemoveAirQloud.message,
          data: responseFromRemoveAirQloud.data,
          status,
        };
      }

      if (responseFromRemoveAirQloud.success === false) {
        let errors = responseFromRemoveAirQloud.errors
          ? responseFromRemoveAirQloud.errors
          : "";

        let status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : "";

        return {
          success: false,
          message: responseFromRemoveAirQloud.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("delete AirQloud util", err.message);
      return {
        success: false,
        message: "unable to delete airqloud",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  refresh: async (request) => {
    try {
      const { query, body } = request;
      const { tenant, id, name, admin_level } = query;

      let requestForUpdateAirQloud = request;
      requestForUpdateAirQloud["body"] = {};
      requestForUpdateAirQloud["body"]["location"] = {};

      let requestForCoordinateRetrieval = {};
      requestForCoordinateRetrieval["query"] = {};
      requestForCoordinateRetrieval["query"]["id"] = id;
      requestForCoordinateRetrieval["query"]["tenant"] = tenant;

      let responseFromRetrieveCoordinates = await createAirqloud.retrieveCoordinates(
        requestForCoordinateRetrieval,
        "airqloud"
      );

      if (responseFromRetrieveCoordinates.success === true) {
        requestForUpdateAirQloud["body"]["location"]["coordinates"] =
          responseFromRetrieveCoordinates.data.coordinates[0];
      }
      if (responseFromRetrieveCoordinates.success === false) {
        return responseFromRetrieveCoordinates;
      }

      // const responseFromFindSites = await createAirqloud.findSites(request);
      // logObject("responseFromFindSites ", responseFromFindSites);
      // if (responseFromFindSites.success === true) {
      //   const sites = responseFromFindSites.data;
      //   requestForUpdateAirQloud["body"]["sites"] = sites;
      // } else if (responseFromFindSites.success === false) {
      //   const status = responseFromFindSites.status
      //     ? responseFromFindSites.status
      //     : "";
      //   const errors = responseFromFindSites.errors
      //     ? responseFromFindSites.errors
      //     : "";
      //   return {
      //     success: false,
      //     message: responseFromFindSites.message,
      //     status,
      //     errors,
      //   };
      // }

      let requestForCalucaltionAirQloudCenter = {};
      requestForCalucaltionAirQloudCenter["body"] = {};
      requestForCalucaltionAirQloudCenter["query"] = {};
      requestForCalucaltionAirQloudCenter["body"]["coordinates"] =
        requestForUpdateAirQloud.body.location.coordinates;

      const responseFromCalculateGeographicalCenter = await createAirqloud.calculateGeographicalCenter(
        requestForCalucaltionAirQloudCenter
      );

      if (responseFromCalculateGeographicalCenter.success === true) {
        requestForUpdateAirQloud["body"]["center_point"] =
          responseFromCalculateGeographicalCenter.data;
      } else if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      }

      const responseFromUpdateAirQloud = await createAirqloud.update(
        requestForUpdateAirQloud
      );
      if (responseFromUpdateAirQloud.success === true) {
        return {
          success: true,
          message: responseFromUpdateAirQloud.message,
          status: httpStatus.OK,
          data: responseFromUpdateAirQloud.data,
        };
      } else if (responseFromUpdateAirQloud.success === false) {
        const status = responseFromUpdateAirQloud.status
          ? responseFromUpdateAirQloud.status
          : "";
        const errors = responseFromUpdateAirQloud.errors
          ? responseFromUpdateAirQloud.errors
          : "";
        return {
          success: false,
          message: responseFromUpdateAirQloud.message,
          status,
          errors,
        };
      }
    } catch (error) {
      logObject("refresh util", error);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  calculateGeographicalCenter: async (request) => {
    try {
      const { body, query } = request;
      const { coordinates } = body;
      const { id } = query;
      let coordinatesForCalculatingCenter = [];

      if (!isEmpty(id)) {
        const responseFromListAirQloud = await createAirqloud.list(request);
        if (responseFromListAirQloud.success === true) {
          if (responseFromListAirQloud.data.length === 1) {
            coordinatesForCalculatingCenter =
              responseFromListAirQloud.data[0].location.coordinates[0];
          } else {
            return {
              success: false,
              message: "unable to retrieve one respective airqloud",
              status: httpStatus.NOT_FOUND,
            };
          }
        } else if (responseFromListAirQloud.success === false) {
          return responseFromListAirQloud;
        }
      }
      if (!isEmpty(coordinates)) {
        coordinatesForCalculatingCenter = coordinates;
      }

      const centerPoint = geolib.getCenter(coordinatesForCalculatingCenter);

      if (!isEmpty(centerPoint)) {
        return {
          success: true,
          message: "Successfully calculated the AirQloud's center point",
          data: centerPoint,
        };
      } else {
        return {
          success: false,
          message: "unable to calculate the geographical center",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  findSites: async (request) => {
    try {
      const { query, body } = request;
      const { id, tenant, name, admin_level } = query;
      let filter = {};
      let site_ids = [];
      filter["_id"] = id;
      let requestForAirQlouds = {};
      requestForAirQlouds["query"] = {};
      requestForAirQlouds["query"]["id"] = id;
      requestForAirQlouds["query"]["admin_level"] = admin_level;
      requestForAirQlouds["query"]["name"] = name;
      requestForAirQlouds["query"]["tenant"] = tenant;
      const responseFromListAirQlouds = await createAirqloud.list(
        requestForAirQlouds
      );

      if (responseFromListAirQlouds.success === true) {
        let airqloud = {};
        let data = responseFromListAirQlouds.data;
        if (data.length > 1 || data.length === 0) {
          return {
            success: false,
            message: "unable to find one match for this airqloud id",
            status: HTTPStatus.NOT_FOUND,
          };
        }

        if (data.length === 1) {
          airqloud = responseFromListAirQlouds.data[0];
          delete airqloud.sites;
        }

        let airqloudArrayOfCoordinates = airqloud.location.coordinates[0];

        let airqloudPolygon = airqloudArrayOfCoordinates.map(function(x) {
          return {
            longitude: x[0],
            latitude: x[1],
          };
        });

        let responseFromListSites = await getModelByTenant(
          tenant.toLowerCase(),
          "site",
          SiteSchema
        ).list({
          filter,
        });

        if (responseFromListSites.success === true) {
          const sites = responseFromListSites.data;
          logObject("sites", sites);
          for (const site of sites) {
            const { latitude, longitude } = site;

            const isSiteInAirQloud = geolib.isPointInPolygon(
              { latitude, longitude },
              airqloudArrayOfCoordinates
            );

            if (isSiteInAirQloud === true) {
              site_ids.push(site._id);
            }
            if (isSiteInAirQloud === false) {
            }
          }

          if (!isEmpty(site_ids)) {
            return {
              success: true,
              message: "successfully searched for the associated Sites",
              data: site_ids,
              status: HTTPStatus.OK,
            };
          } else if (isEmpty(site_ids)) {
            return {
              success: true,
              message: "no associated Sites found",
              data: site_ids,
              status: HTTPStatus.OK,
            };
          }
        } else if (responseFromListSites.success === false) {
          return {
            success: false,
            message: responseFromListSites.message,
            status: responseFromListSites.status,
          };
        }
      } else if (responseFromListAirQlouds.success === false) {
        const status = responseFromListAirQlouds.status
          ? responseFromListAirQlouds.status
          : "";
        const errors = responseFromListAirQlouds.errors
          ? responseFromListAirQlouds.errors
          : "";
        return {
          success: false,
          message: responseFromListAirQlouds.message,
          errors,
          status,
        };
      }
    } catch (error) {
      logObject("findSites util", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;
      let filter = generateFilter.airqlouds(request);

      let responseFromListAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).list({
        filter,
        limit,
        skip,
      });

      if (responseFromListAirQloud.success === false) {
        let errors = responseFromListAirQloud.errors
          ? responseFromListAirQloud.errors
          : "";

        let status = responseFromListAirQloud.status
          ? responseFromListAirQloud.status
          : "";
        return {
          success: false,
          message: responseFromListAirQloud.message,
          errors,
          status,
        };
      }

      if (responseFromListAirQloud.success === true) {
        let status = responseFromListAirQloud.status
          ? responseFromListAirQloud.status
          : "";
        let data = responseFromListAirQloud.data;
        return {
          success: true,
          message: responseFromListAirQloud.message,
          data,
          status,
        };
      }
    } catch (err) {
      logElement("list AirQlouds util", err.message);
      return {
        success: false,
        message: "unable to list airqloud",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createAirqloud;
