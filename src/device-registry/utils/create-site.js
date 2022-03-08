const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const SiteSchema = require("../models/Site");
const UniqueIdentifierCounterSchema = require("../models/UniqueIdentifierCounter");
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
const log4js = require("log4js");
const HTTPStatus = require("http-status");
const logger = log4js.getLogger("create-site-util");
const distance = require("./distance");

const SiteModel = (tenant) => {
  getModelByTenant(tenant.toLowerCase(), "site", SiteSchema);
};

const createAirqloudUtil = require("./create-airqloud");
const pointInPolygon = require("point-in-polygon");
const httpStatus = require("http-status");
const geolib = require("geolib");
const { kafkaProducer, kafkaClient } = require("../config/kafkajs");

const DeviceSchema = require("../models/Device");
const SiteActivitySchema = require("../models/SiteActivity");
const mongoose = require("mongoose");
const { threeMonthsFromNow } = require("./date");
const createDeviceUtil = require("./create-device");

const manageSite = {
  hasWhiteSpace: (name) => {
    try {
      return name.indexOf(" ") >= 0;
    } catch (e) {
      logger.error(
        `create site util server error -- hasWhiteSpace -- ${{
          message: e.message,
        }}`
      );
    }
  },

  checkStringLength: (name) => {
    try {
      let length = name.length;
      if (length >= 5 && length <= 50) {
        return true;
      }
      return false;
    } catch (e) {
      logger.error(
        `create site util server error -- check string length -- ${{
          message: e.message,
        }}`
      );
    }
  },
  findAirQlouds: async (request) => {
    try {
      const { query, body } = request;
      const { id, tenant } = query;
      let filter = {};
      filter["_id"] = id;
      const responseFromListSites = await manageSite.list({ tenant, filter });
      if (responseFromListSites.success === true) {
        let data = responseFromListSites.data;
        if (data.length > 1 || data.length === 0) {
          return {
            success: false,
            message: "unable to find one match for this site",
            status: HTTPStatus.NOT_FOUND,
          };
        }
        const { latitude, longitude } = data[0];
        let requestForAirQlouds = {};
        requestForAirQlouds["query"] = {};
        requestForAirQlouds["query"]["tenant"] = tenant;
        const responseFromListAirQlouds = await createAirqloudUtil.list(
          requestForAirQlouds
        );
        if (responseFromListAirQlouds.success === true) {
          const airqlouds = responseFromListAirQlouds.data;
          let airqloud_ids = [];
          for (const airqloud of airqlouds) {
            delete airqlouds.sites;
            logObject("airqloud", airqloud);
            let airqloudArrayOfCoordinates = airqloud.location.coordinates[0];
            let airqloudPolygon = airqloudArrayOfCoordinates.map(function(x) {
              return {
                longitude: x[0],
                latitude: x[1],
              };
            });
            logObject("airqloudPolygon", airqloudPolygon);
            const isSiteInAirQloud = geolib.isPointInPolygon(
              { latitude, longitude },
              airqloudPolygon
            );

            if (isSiteInAirQloud === true) {
              airqloud_ids.push(airqloud._id);
            }
          }
          if (!isEmpty(airqloud_ids)) {
            return {
              success: true,
              message: "successfully searched for the associated AirQlouds",
              data: airqloud_ids,
              status: HTTPStatus.OK,
            };
          }
          if (isEmpty(airqloud_ids)) {
            return {
              success: true,
              message: "no associated AirQlouds found",
              data: airqloud_ids,
              status: HTTPStatus.OK,
            };
          }
        }

        if (responseFromListAirQlouds.success === false) {
          return {
            success: false,
            message: responseFromListAirQlouds.message,
            status: responseFromListAirQlouds.status,
          };
        }
      }
      if (responseFromListSites.success === false) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : "";
        const errors = responseFromListSites.errors
          ? responseFromListSites.errors
          : "";
        return {
          success: false,
          message: responseFromListSites.message,
          errors,
          status,
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
  findNearestWeatherStation: async (request) => {
    try {
      const { query, body } = request;
      const { id, tenant } = query;
      let filter = {};
      filter["_id"] = id;
      const responseFromListSites = await manageSite.list({ tenant, filter });
      if (responseFromListSites.success === true) {
        let data = responseFromListSites.data;
        if (data.length > 1 || data.length === 0) {
          return {
            success: false,
            message: "unable to find one match for this site",
            status: HTTPStatus.NOT_FOUND,
          };
        }
        const { latitude, longitude } = data[0];
        const responseFromListWeatherStations = await manageSite.listWeatherStations();
        if (responseFromListWeatherStations.success === true) {
          const nearestWeatherStation = geolib.findNearest(
            { latitude, longitude },
            responseFromListWeatherStations.data
          );
          logObject("nearestWeatherStation", nearestWeatherStation);
          return {
            success: true,
            message: "successfully returned the nearest weather station",
            data: nearestWeatherStation,
            status: HTTPStatus.OK,
          };
        }
        if (responseFromListWeatherStations.success === false) {
          return {
            success: false,
            message: responseFromListWeatherStations.message,
            status: responseFromListWeatherStations.status,
          };
        }
      }
      if (responseFromListSites.success === false) {
        const status = responseFromListSites.status
          ? responseFromListSites.status
          : "";
        const errors = responseFromListSites.errors
          ? responseFromListSites.errors
          : "";
        return {
          success: false,
          message: responseFromListSites.message,
          errors,
          status,
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

  listWeatherStations: async () => {
    try {
      const url = constants.TAHMO_API_GET_STATIONS_URL;
      return await axios
        .get(url, {
          auth: {
            username: constants.TAHMO_API_CREDENTIALS_USERNAME,
            password: constants.TAHMO_API_CREDENTIALS_PASSWORD,
          },
        })
        .then((res) => {
          let responseJSON = res.data;
          if (!isEmpty(responseJSON)) {
            data = responseJSON.data;
            let outputs = [];
            data.forEach((element) => {
              let output = {};
              output["id"] = element.id;
              output["code"] = element.code;
              output["latitude"] = element.location.latitude;
              output["longitude"] = element.location.longitude;
              output["elevation"] = element.location.elevationmsl;
              output["countrycode"] = element.location.countrycode;
              output["timezone"] = element.location.timezone;
              output["timezoneoffset"] = element.location.timezoneoffset;
              output["name"] = element.location.name;
              output["type"] = element.location.type;
              outputs.push(output);
            });

            return {
              success: true,
              message: "successfully retrieved all the stations",
              status: HTTPStatus.OK,
              data: outputs,
            };
          }
          if (isEmpty(responseJSON.data)) {
            logElement("unable to list stations");
          }
        })
        .catch((error) => {
          return {
            success: false,
            errors: { message: error },
            message: "Internal Server Error",
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        });
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  validateSiteName: (name) => {
    try {
      // let nameHasWhiteSpace = manageSite.hasWhiteSpace(name);
      let isValidStringLength = manageSite.checkStringLength(name);
      if (isValidStringLength) {
        return true;
      }
      return false;
    } catch (e) {
      logger.error(
        `create site util server error -- validate site name -- ${{
          message: e.message,
        }}`
      );
    }
  },

  generateName: async (tenant) => {
    try {
      let filter = {
        NAME: "site_0",
      };

      let update = {
        $inc: { COUNT: 1 },
      };

      let responseFromModifyUniqueIdentifierCounter = await getModelByTenant(
        tenant.toLowerCase(),
        "uniqueIdentifierCounter",
        UniqueIdentifierCounterSchema
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyUniqueIdentifierCounter.success === false) {
        logger.error(
          `unable to find the counter document, please first create it`
        );
        let errors = responseFromModifyUniqueIdentifierCounter.errors
          ? responseFromModifyUniqueIdentifierCounter.errors
          : {};
        logObject("error", errors);

        let status = responseFromModifyUniqueIdentifierCounter.status
          ? responseFromModifyUniqueIdentifierCounter.status
          : "";

        return {
          success: false,
          message:
            "unable to generate unique name for this site, contact support",
          errors,
          status,
        };
      }

      if (responseFromModifyUniqueIdentifierCounter.success === true) {
        const status = responseFromModifyUniqueIdentifierCounter.status
          ? responseFromModifyUniqueIdentifierCounter.status
          : "";
        const count = responseFromModifyUniqueIdentifierCounter.data.COUNT;
        const siteName = `site_${count}`;
        return {
          success: true,
          message: "unique name generated for this site",
          data: siteName,
          status,
        };
      }
    } catch (e) {
      logger.error(
        `generateName util server error -- ${{ message: e.message }}`
      );
      return {
        success: false,
        errors: { message: { message: e.message } },
        message: "generateName -- createSite util server error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  create: async (tenant, req) => {
    try {
      const { body, query } = req;
      const { tenant } = query;
      const { name, latitude, longitude, airqlouds } = body;
      let request = {};
      request["body"] = {};
      request["query"] = {};
      request["body"]["latitude"] = latitude;
      request["body"]["longitude"] = longitude;
      request["body"]["airqlouds"] = airqlouds;
      request["body"]["name"] = name;
      request["query"]["tenant"] = tenant;

      let generated_name = null;
      let requestBodyForCreatingSite = {};

      let isNameValid = manageSite.validateSiteName(name);
      if (!isNameValid) {
        return {
          success: false,
          message: "site name is invalid, please check documentation",
        };
      }

      let lat_long = manageSite.generateLatLong(latitude, longitude);
      request["body"]["lat_long"] = lat_long;

      let responseFromGenerateName = await manageSite.generateName(tenant);
      logObject("responseFromGenerateName", responseFromGenerateName);
      if (responseFromGenerateName.success === true) {
        generated_name = responseFromGenerateName.data;
        request["body"]["generated_name"] = generated_name;
      } else if (responseFromGenerateName.success === false) {
        let errors = responseFromGenerateName.errors
          ? responseFromGenerateName.errors
          : "";
        let status = responseFromGenerateName.status
          ? responseFromGenerateName.status
          : "";
        return {
          success: false,
          message: responseFromGenerateName.message,
          errors,
          status,
        };
      }

      let responseFromGenerateMetadata = await manageSite.generateMetadata(
        request
      );
      logObject("responseFromGenerateMetadata", responseFromGenerateMetadata);
      if (responseFromGenerateMetadata.success === true) {
        requestBodyForCreatingSite = responseFromGenerateMetadata.data;
      } else if (responseFromGenerateMetadata.success === false) {
        let errors = responseFromGenerateMetadata.errors
          ? responseFromGenerateMetadata.errors
          : "";
        let status = responseFromGenerateMetadata.status
          ? responseFromGenerateMetadata.status
          : "";
        return {
          success: false,
          message: responseFromGenerateMetadata.message,
          errors,
          status,
        };
      }

      let responseFromCreateSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).register(requestBodyForCreatingSite);

      if (responseFromCreateSite.success === true) {
        let createdSite = responseFromCreateSite.data;
        try {
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: "sites-topic",
            messages: [
              {
                action: "create",
                value: JSON.stringify(createdSite),
              },
            ],
          });

          await kafkaProducer.disconnect();
        } catch (error) {
          logObject("error on kafka", error);
        }

        let status = responseFromCreateSite.status
          ? responseFromCreateSite.status
          : "";
        return {
          success: true,
          message: "Site successfully created",
          data: createdSite,
          status,
        };
      }

      if (responseFromCreateSite.success === false) {
        let errors = responseFromCreateSite.errors
          ? responseFromCreateSite.errors
          : "";
        let status = responseFromCreateSite.status
          ? responseFromCreateSite.status
          : "";
        return {
          success: false,
          message: responseFromCreateSite.message,
          errors,
          status,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: { message: e.message } },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  update: async (tenant, filter, update) => {
    try {
      let responseFromModifySite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).modify({
        filter,
        update,
      });
      if (responseFromModifySite.success === true) {
        let status = responseFromModifySite.status
          ? responseFromModifySite.status
          : "";
        return {
          success: true,
          message: responseFromModifySite.message,
          data: responseFromModifySite.data,
          status,
        };
      }

      if (responseFromModifySite.success === false) {
        let errors = responseFromModifySite.errors
          ? responseFromModifySite.errors
          : "";

        let status = responseFromModifySite.status
          ? responseFromModifySite.status
          : "";

        return {
          success: false,
          message: responseFromModifySite.message,
          errors,
          status,
        };
      }
    } catch (e) {
      logElement("update Sites util", { message: e.message });
      return {
        success: false,
        message: "create site util server error -- update",
        errors: { message: e.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  sanitiseName: (name) => {
    try {
      let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
      let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
      let trimmedName = shortenedName.trim();
      return trimmedName.toLowerCase();
    } catch (error) {
      logger.error(
        `sanitiseName -- create site util -- ${{ message: error.message }}`
      );
    }
  },

  getRoadMetadata: async (latitude, longitude) => {
    try {
      let response = {};
      let promises = [];
      const paths = constants.GET_ROAD_METADATA_PATHS;
      const arrayOfPaths = Object.entries(paths);
      for (const [key, path] of arrayOfPaths) {
        const url = constants.GET_ROAD_METADATA({
          path,
          latitude,
          longitude,
        });
        promises.push(
          axios
            .get(url)
            .then((res) => {
              let responseJSON = res.data;
              if (!isEmpty(responseJSON.data)) {
                let data = responseJSON.data;
                response[key] = data;
              }
              if (isEmpty(responseJSON.data)) {
                logElement("unable to get the information for", key);
              }
            })
            .catch((error) => {
              return {
                success: false,
                errors: { message: error },
                message: "constants server side error",
                status: httpStatus.INTERNAL_SERVER_ERROR,
              };
            })
        );
      }

      return await Promise.all(promises).then(() => {
        if (!isEmpty(response)) {
          return {
            success: true,
            message: "successfully retrieved the road metadata",
            status: HTTPStatus.OK,
            data: response,
          };
        }

        if (isEmpty(response)) {
          return {
            success: false,
            message: "unable to retrieve any road metadata",
            status: HTTPStatus.NOT_FOUND,
          };
        }
      });
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  generateMetadata: async (req) => {
    try {
      let { query, body } = req;
      let { latitude, longitude } = body;
      let { tenant, id } = query;
      let roadResponseData = {};
      let altitudeResponseData = {};
      let reverseGeoCodeResponseData = {};

      logElement("the tenant in metadata", tenant);

      logger.info(`the body sent to generate metadata -- ${body}`);

      let responseFromGetAltitude = await manageSite.getAltitude(
        latitude,
        longitude
      );

      logger.info(`responseFromGetAltitude -- ${responseFromGetAltitude}`);
      if (responseFromGetAltitude.success === true) {
        altitudeResponseData["altitude"] = responseFromGetAltitude.data;
      }

      if (responseFromGetAltitude.success === false) {
        let errors = responseFromGetAltitude.errors
          ? responseFromGetAltitude.errors
          : "";
        logger.error(
          `unable to retrieve the altitude for this site, ${responseFromGetAltitude.message} and ${errors}`
        );
      }

      let responseFromGetRoadMetadata = await manageSite.getRoadMetadata(
        latitude,
        longitude
      );

      logObject("responseFromGetRoadMetadata", responseFromGetRoadMetadata);

      if (responseFromGetRoadMetadata.success === true) {
        roadResponseData = responseFromGetRoadMetadata.data;
      }

      if (responseFromGetRoadMetadata.success === false) {
        let errors = responseFromGetRoadMetadata.errors
          ? responseFromGetRoadMetadata.errors
          : "";
        logger.error(
          `unable to retrieve the road metadata, ${responseFromGetRoadMetadata.message} and ${errors} `
        );
      }

      let responseFromReverseGeoCode = await manageSite.reverseGeoCode(
        latitude,
        longitude
      );
      logger.info(
        `responseFromReverseGeoCode -- ${responseFromReverseGeoCode}`
      );
      if (responseFromReverseGeoCode.success === true) {
        reverseGeoCodeResponseData = responseFromReverseGeoCode.data;
        let google_site_tags = responseFromReverseGeoCode.data.site_tags;
        let existing_site_tags = body.site_tags ? body.site_tags : [];
        let merged_site_tags = [...google_site_tags, ...existing_site_tags];
        body["site_tags"] = merged_site_tags;
        let finalResponseBody = {
          ...reverseGeoCodeResponseData,
          ...body,
          ...roadResponseData,
          ...altitudeResponseData,
        };
        let status = responseFromReverseGeoCode.status
          ? responseFromReverseGeoCode.status
          : "";
        return {
          success: true,
          message: "successfully generated the metadata",
          data: finalResponseBody,
          status,
        };
      }

      if (responseFromReverseGeoCode.success === false) {
        let errors = responseFromReverseGeoCode.errors
          ? responseFromReverseGeoCode.errors
          : "";
        let status = responseFromReverseGeoCode.status
          ? responseFromReverseGeoCode.status
          : "";
        return {
          success: false,
          message: responseFromReverseGeoCode.message,
          errors,
          status,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: { message: e.message } },
      };
    }
  },

  pickAvailableValue: (valuesInObject) => {
    let arrayOfSiteNames = Object.values(valuesInObject);
    let availableName = arrayOfSiteNames.find(Boolean);
    return availableName;
  },

  refresh: async (tenant, req) => {
    try {
      const { id } = req.query;
      let filter = generateFilter.sites(req);
      let update = {};
      let request = {};
      request["query"] = {};
      let generated_name = null;
      logObject("the filter being used to filter", filter);

      let responseFromListSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).list({
        filter,
      });

      if (responseFromListSite.success === true) {
        let siteDetails = { ...responseFromListSite.data[0] };
        request["body"] = siteDetails;
        delete request.body._id;
        delete request.body.devices;
      }

      if (responseFromListSite.success === false) {
        let errors = responseFromListSite.errors
          ? responseFromListSite.errors
          : "";
        let status = responseFromListSite.status
          ? responseFromListSite.status
          : "";
        return {
          message: responseFromListSite.message,
          status,
          errors,
        };
      }

      logger.info(`refresh -- responseFromListSite -- ${responseFromListSite}`);

      let {
        name,
        parish,
        county,
        district,
        latitude,
        longitude,
      } = request.body;

      if (!name) {
        let siteNames = { name, parish, county, district };
        let availableName = manageSite.pickAvailableValue(siteNames);
        let isNameValid = manageSite.validateSiteName(availableName);
        if (!isNameValid) {
          let sanitisedName = manageSite.sanitiseName(availableName);
          request["body"]["name"] = sanitisedName;
        }
        request["body"]["name"] = availableName;
      }

      let lat_long = manageSite.generateLatLong(latitude, longitude);
      request["body"]["lat_long"] = lat_long;

      if (isEmpty(request["body"]["generated_name"])) {
        let responseFromGenerateName = await manageSite.generateName(tenant);
        logObject("responseFromGenerateName", responseFromGenerateName);
        if (responseFromGenerateName.success === true) {
          generated_name = responseFromGenerateName.data;
          request["body"]["generated_name"] = generated_name;
        }
        if (responseFromGenerateName.success === false) {
          let errors = responseFromGenerateName.errors
            ? responseFromGenerateName.errors
            : "";
          return {
            success: false,
            message: responseFromGenerateName.message,
            errors,
          };
        }
      }

      let requestForAirQloudsAndWeatherStations = {};
      requestForAirQloudsAndWeatherStations["query"] = {};
      requestForAirQloudsAndWeatherStations["query"]["tenant"] = tenant;
      requestForAirQloudsAndWeatherStations["query"]["id"] = id;
      let responseFromFindAirQlouds = await manageSite.findAirQlouds(
        requestForAirQloudsAndWeatherStations
      );

      if (responseFromFindAirQlouds.success === true) {
        request["body"]["airqlouds"] = responseFromFindAirQlouds.data;
      }

      if (responseFromFindAirQlouds.success === false) {
        logObject(
          "responseFromFindAirQlouds was unsuccessful",
          responseFromFindAirQlouds
        );
      }

      const responseFromNearestWeatherStation = await manageSite.findNearestWeatherStation(
        requestForAirQloudsAndWeatherStations
      );

      logObject(
        "responseFromNearestWeatherStation",
        responseFromNearestWeatherStation
      );

      if (responseFromNearestWeatherStation.success === true) {
        let nearest_tahmo_station = responseFromNearestWeatherStation.data;
        delete nearest_tahmo_station.elevation;
        delete nearest_tahmo_station.countrycode;
        delete nearest_tahmo_station.timezoneoffset;
        delete nearest_tahmo_station.name;
        delete nearest_tahmo_station.type;
        request["body"]["nearest_tahmo_station"] = nearest_tahmo_station;
      }

      if (responseFromNearestWeatherStation.success === false) {
        logObject(
          "unable to find the nearest weather station",
          responseFromNearestWeatherStation
        );
      }

      request["query"]["tenant"] = tenant;
      let responseFromGenerateMetadata = await manageSite.generateMetadata(
        request
      );

      logObject("responseFromGenerateMetadata", responseFromGenerateMetadata);

      logger.info(
        `refresh -- responseFromGenerateMetadata-- ${responseFromGenerateMetadata}`
      );

      if (responseFromGenerateMetadata.success === true) {
        update = responseFromGenerateMetadata.data;
      }

      if (responseFromGenerateMetadata.success === false) {
        let errors = responseFromGenerateMetadata.errors
          ? responseFromGenerateMetadata.errors
          : "";
        return {
          success: false,
          message: responseFromGenerateMetadata.message,
          errors,
        };
      }

      logObject("the update", update);

      logger.info(`refresh -- update -- ${update}`);

      let responseFromModifySite = await manageSite.update(
        tenant,
        filter,
        update
      );

      logger.info(
        `refresh -- responseFromModifySite -- ${responseFromModifySite} `
      );

      if (responseFromModifySite.success === true) {
        return {
          success: true,
          message: "Site details successfully refreshed",
          data: responseFromModifySite.data,
        };
      }

      if (responseFromModifySite.success === false) {
        let errors = responseFromModifySite.errors
          ? responseFromModifySite.errors
          : "";
        return {
          success: false,
          message: responseFromModifySite.message,
          errors,
        };
      }
    } catch (error) {
      return {
        errors: { message: error.message },
        message: "create site util -- server error -- refresh site data",
        success: false,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  delete: async (tenant, filter) => {
    try {
      return {
        success: false,
        message: "feature temporarity disabled --coming soon",
        status: HTTPStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      let responseFromRemoveSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).remove({
        filter,
      });
      if (responseFromRemoveSite.success === true) {
        return {
          success: true,
          message: responseFromRemoveSite.message,
          data: responseFromRemoveSite.data,
        };
      }

      if (responseFromRemoveSite.success === false) {
        let errors = responseFromRemoveSite.errors
          ? responseFromRemoveSite.errors
          : "";

        let status = responseFromRemoveSite.status
          ? responseFromRemoveSite.status
          : "";

        return {
          success: false,
          message: responseFromRemoveSite.message,
          errors,
          status,
        };
      }
    } catch (e) {
      logElement("delete Site util", { message: e.message });
      return {
        success: false,
        message: "delete Site util server error",
        errors: { message: e.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async ({ tenant, filter, _skip, _limit }) => {
    try {
      logObject("the filter", filter);
      logElement("the tenant", tenant);
      let responseFromListSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).list({
        filter,
        _limit,
        _skip,
      });

      if (responseFromListSite.success === false) {
        let errors = responseFromListSite.errors
          ? responseFromListSite.errors
          : "";

        let status = responseFromListSite.status
          ? responseFromListSite.status
          : "";
        return {
          success: false,
          message: responseFromListSite.message,
          errors,
          status,
        };
      }

      if (responseFromListSite.success === true) {
        data = responseFromListSite.data.filter(function(obj) {
          return obj.lat_long !== "4_4";
        });
        let status = responseFromListSite.status
          ? responseFromListSite.status
          : "";
        return {
          success: true,
          message: "successfully listed the site(s)",
          data,
          status,
        };
      }
    } catch (e) {
      logElement("list Sites util", { message: e.message });
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  formatSiteName: (name) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  retrieveInformationFromAddress: (address) => {
    try {
      let results = address.results[0];
      let address_components = results.address_components;
      let formatted_name = results.formatted_address;
      let geometry = results.geometry;
      let google_place_id = results.place_id;
      let types = results.types;
      let retrievedAddress = {};
      address_components.forEach((object) => {
        if (object.types.includes("locality", "administrative_area_level_3")) {
          retrievedAddress.town = object.long_name;
          retrievedAddress.city = object.long_name;
        }
        if (object.types.includes("administrative_area_level_2")) {
          retrievedAddress.district = object.long_name;
          retrievedAddress.county = object.long_name;
        }
        if (object.types.includes("administrative_area_level_1")) {
          retrievedAddress.region = object.long_name;
        }
        if (object.types.includes("route")) {
          retrievedAddress.street = object.long_name;
        }
        if (object.types.includes("country")) {
          retrievedAddress.country = object.long_name;
        }
        if (object.types.includes("sublocality", "sublocality_level_1")) {
          retrievedAddress.parish = object.long_name;
          retrievedAddress.division = object.long_name;
          retrievedAddress.village = object.long_name;
          retrievedAddress.sub_county = object.long_name;
        }
        retrievedAddress.formatted_name = formatted_name;
        retrievedAddress.geometry = geometry;
        retrievedAddress.site_tags = types;
        retrievedAddress.google_place_id = google_place_id;
      });
      return {
        success: true,
        message: "retrieved the Google address details of this site",
        data: retrievedAddress,
      };
    } catch (e) {
      return {
        success: false,
        message: "unable to transform the address",
        errors: { message: { message: e.message } },
      };
    }
  },

  reverseGeoCode: async (latitude, longitude) => {
    try {
      logText("reverseGeoCode...........");
      let url = constants.GET_ADDRESS_URL(latitude, longitude);
      return await axios
        .get(url)
        .then(async (response) => {
          let responseJSON = response.data;
          if (!isEmpty(responseJSON.results)) {
            let responseFromTransformAddress = manageSite.retrieveInformationFromAddress(
              responseJSON
            );
            if (responseFromTransformAddress.success === true) {
              return {
                success: true,
                data: responseFromTransformAddress.data,
                message: responseFromTransformAddress.message,
              };
            } else if (responseFromTransformAddress.success === false) {
              if (responseFromTransformAddress.errors) {
                return {
                  success: false,
                  errors: responseFromTransformAddress.errors,
                  message: responseFromTransformAddress.message,
                };
              } else {
                return {
                  success: false,
                  message: responseFromTransformAddress.message,
                };
              }
            }
          } else {
            return {
              success: false,
              message: "unable to get the site address details",
              status: HTTPStatus.NOT_FOUND,
              errors: {
                message:
                  "review the GPS coordinates provided, we cannot get corresponding metadata",
              },
            };
          }
        })
        .catch((error) => {
          return {
            success: false,
            errors: { message: error },
            message: "constants server side error",
          };
        });
    } catch (e) {
      return {
        success: false,
        message: "unable to get the address values",
        errors: { message: { message: e.message } },
      };
    }
  },

  getDistance: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  getLandform: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  getAltitude: (lat, long) => {
    try {
      return client
        .elevation(
          {
            params: {
              locations: [{ lat: lat, lng: long }],
              key: process.env.GOOGLE_MAPS_API_KEY,
            },
            timeout: 1000, // milliseconds
          },
          axiosInstance()
        )
        .then((r) => {
          return {
            success: true,
            message: "successfully retrieved the altitude details",
            data: r.data.results[0].elevation,
            status: HTTPStatus.OK,
          };
        })
        .catch((e) => {
          logElement("get altitude server error", { message: e.message });
          return {
            success: false,
            message: "get altitude server error",
            errors: { message: e },
            status: HTTPStatus.BAD_GATEWAY,
          };
        });
    } catch (e) {
      logElement("server error", { message: e.message });
      return {
        success: false,
        message: "get altitude server error",
        errors: { message: e.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  getTrafficFactor: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  getGreenness: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  getTerrain: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  getAspect: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  getRoadIntesity: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  getRoadStatus: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  getLandUse: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  generateLatLong: (lat, long) => {
    try {
      return `${lat}_${long}`;
    } catch (e) {
      logElement("server error", { message: e.message });
    }
  },

  findNearestSitesByCoordinates: async (request) => {
    try {
      let { radius, latitude, longitude, tenant } = request;
      const responseFromListSites = await manageSite.list({
        tenant,
      });

      if (responseFromListSites.success === true) {
        let sites = responseFromListSites.data;
        let status = responseFromListSites.status
          ? responseFromListSites.status
          : "";
        let nearest_sites = [];
        sites.forEach((site) => {
          if ("latitude" in site && "longitude" in site) {
            let distance = distance.distanceBtnTwoPoints(
              latitude,
              longitude,
              site["latitude"],
              site["longitude"]
            );

            if (distance < radius) {
              site["distance"] = distance;
              nearest_sites.push(site);
            }
          }
        });
        return {
          success: true,
          data: nearest_sites,
          message: "successfully retrieved the nearest sites",
          status,
        };
      }
      if (responseFromListSites.success === false) {
        let status = responseFromListSites.status
          ? responseFromListSites.status
          : "";
        let errors = responseFromListSites.errors
          ? responseFromListSites.errors
          : "";
        return {
          success: false,
          errors,
          message: responseFromListSites.message,
          status,
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

  getGpsCoordinates: async (locationName, tenant) => {
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
  },
  carryOutActivity: async (
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
  },
  doesLocationExist: async (locationName, tenant) => {
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
  },

  siteActivityRequestBodies: (req, res, type = null) => {
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
  },
  isDeviceRecalled: async (name, tenant) => {
    try {
      logText("....................");
      logText("checking isDeviceRecalled....");

      let request = {};
      request["query"] = {};
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;

      const responseFromListDevice = await createDeviceUtil.list(request);

      let device = {};

      if (responseFromListDevice.success === true) {
        if (responseFromListDevice.data.length === 1) {
          device = responseFromListDevice.data[0];
        }
      } else if (responseFromListDevice.success === false) {
        logObject(
          "responseFromListDevice has an error",
          responseFromListDevice
        );
      }
      logObject("device", device);
      const isRecalled = !device.isActive;
      logElement("locationName", device.locationName);
      logElement("isRecalled", isRecalled);
      return isRecalled;
    } catch (e) {
      logText("error", e);
    }
  },
  isDeviceDeployed: async (name, tenant) => {
    try {
      logText("....................");
      logText("checking isDeviceNotDeployed....");

      let request = {};
      request["query"] = {};
      request["query"]["name"] = name;
      request["query"]["tenant"] = tenant;

      const responseFromListDevice = await createDeviceUtil.list(request);

      let device = {};

      if (responseFromListDevice.success === true) {
        if (responseFromListDevice.data.length === 1) {
          device = responseFromListDevice.data[0];
        }
      } else if (responseFromListDevice.success === false) {
        logObject(
          "responseFromListDevice has an error",
          responseFromListDevice
        );
      }
      logObject("device", device);
      const isDeployed = device.isActive;
      logElement("isDeployed", isDeployed);
      return isDeployed;
    } catch (e) {
      logText("error", e);
    }
  },
  queryFilterOptions: async (req, res) => {
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
  },
  bodyFilterOptions: async (req, res) => {
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
  },
};

module.exports = manageSite;
