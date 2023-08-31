const SiteModel = require("@models/Site");
const UniqueIdentifierCounterModel = require("@models/UniqueIdentifierCounter");
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const axios = require("axios");
const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});
const axiosInstance = () => {
  return axios.create();
};
const generateFilter = require("./generate-filter");
const httpStatus = require("http-status");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-site-util`
);
const distanceUtil = require("./distance");
const createAirqloudUtil = require("./create-airqloud");
const pointInPolygon = require("point-in-polygon");
const geolib = require("geolib");

const {
  threeMonthsFromNow,
  generateDateFormatWithoutHrs,
  monthsInfront,
} = require("./date");

const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createSite = {
  hasWhiteSpace: (name) => {
    try {
      return name.indexOf(" ") >= 0;
    } catch (e) {
      logger.error(
        `create site util server error -- hasWhiteSpace -- ${e.message}`
      );
    }
  },
  checkStringLength: (name) => {
    try {
      //check if name has only white spaces
      name = name.trim();
      let length = name.length;
      if (length >= 5 && length <= 50) {
        return true;
      }
      return false;
    } catch (e) {
      logger.error(
        `internal server error -- check string length -- ${e.message}`
      );
    }
  },
  findAirQlouds: async (request) => {
    try {
      const { query, body } = request;
      const { id, tenant } = query;
      let filter = {};
      filter["_id"] = id;
      const responseFromListSites = await createSite.list({ tenant, filter });
      if (responseFromListSites.success === true) {
        let data = responseFromListSites.data;
        if (data.length > 1 || data.length === 0) {
          return {
            success: false,
            message: "unable to find one match for this site",
            status: httpStatus.NOT_FOUND,
            errors: { message: "unable to find one match for this site" },
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
            let airqloudArrayOfCoordinates = airqloud.location.coordinates[0];
            let airqloudPolygon = airqloudArrayOfCoordinates.map(function(x) {
              return {
                longitude: x[0],
                latitude: x[1],
              };
            });
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
              status: httpStatus.OK,
            };
          } else if (isEmpty(airqloud_ids)) {
            return {
              success: true,
              message: "no associated AirQlouds found",
              data: airqloud_ids,
              status: httpStatus.OK,
            };
          }
        } else if (responseFromListAirQlouds.success === false) {
          return responseFromListAirQlouds;
        }
      } else if (responseFromListSites.success === false) {
        return responseFromListSites;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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
      const responseFromListSites = await createSite.list({ tenant, filter });
      if (responseFromListSites.success === true) {
        let data = responseFromListSites.data;
        if (data.length > 1 || data.length === 0) {
          return {
            success: false,
            message: "unable to find one match for this site",
            status: httpStatus.NOT_FOUND,
          };
        }
        const { latitude, longitude } = data[0];
        const responseFromListWeatherStations = await createSite.listWeatherStations();
        if (responseFromListWeatherStations.success === true) {
          const nearestWeatherStation = geolib.findNearest(
            { latitude, longitude },
            responseFromListWeatherStations.data
          );
          return {
            success: true,
            message: "successfully returned the nearest weather station",
            data: nearestWeatherStation,
            status: httpStatus.OK,
          };
        } else if (responseFromListWeatherStations.success === false) {
          return responseFromListWeatherStations;
        }
      } else if (responseFromListSites.success === false) {
        return responseFromListSites;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
              status: httpStatus.OK,
              data: outputs,
            };
          }
          if (isEmpty(responseJSON.data)) {
            logElement("Unable to list stations, List of stations is empty.");
            return {
              success: false,
              message: "List of stations is empty",
              status: httpStatus.NOT_FOUND,
              errors: { message: "unable to list stations" },
              data: [],
            };
          }
        })
        .catch((error) => {
          try {
            logger.error(`internal server error -- ${JSON.stringify(error)}`);
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return {
            success: false,
            errors: { message: error },
            message: "Bad Gateway Error",
            status: httpStatus.BAD_GATEWAY,
          };
        });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  validateSiteName: (name) => {
    try {
      // let nameHasWhiteSpace = createSite.hasWhiteSpace(name);
      let isValidStringLength = createSite.checkStringLength(name);
      if (isValidStringLength) {
        return true;
      }
      return false;
    } catch (e) {
      logger.error(
        `internal server error -- validate site name -- ${e.message}`
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

      const responseFromModifyUniqueIdentifierCounter = await UniqueIdentifierCounterModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyUniqueIdentifierCounter.success === false) {
        logger.error(
          `unable to find the counter document, please first create it`
        );
        return {
          success: false,
          message:
            "unable to generate unique name for this site, contact support",
          errors: responseFromModifyUniqueIdentifierCounter.errors
            ? responseFromModifyUniqueIdentifierCounter.errors
            : { message: "" },
          status: responseFromModifyUniqueIdentifierCounter.status
            ? responseFromModifyUniqueIdentifierCounter.status
            : httpStatus.BAD_REQUEST,
        };
      } else if (responseFromModifyUniqueIdentifierCounter.success === true) {
        const count = responseFromModifyUniqueIdentifierCounter.data.COUNT;
        const siteName = `site_${count}`;
        return {
          success: true,
          message: "unique name generated for this site",
          data: siteName,
          status: responseFromModifyUniqueIdentifierCounter.status
            ? responseFromModifyUniqueIdentifierCounter.status
            : httpStatus.OK,
        };
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        errors: { message: e.message },
        message: "generateName -- createSite util server error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (tenant, req) => {
    try {
      const { body, query } = req;
      const { tenant } = query;
      const {
        name,
        latitude,
        longitude,
        airqlouds,
        network,
        approximate_distance_in_km,
      } = body;

      let request = {};
      request["body"] = body;
      request["query"] = {};
      request["query"]["tenant"] = tenant;

      const responseFromApproximateCoordinates = createSite.createApproximateCoordinates(
        { latitude, longitude, approximate_distance_in_km }
      );

      if (responseFromApproximateCoordinates.success === true) {
        const {
          approximate_latitude,
          approximate_longitude,
          bearing_in_radians,
          approximate_distance_in_km,
        } = responseFromApproximateCoordinates.data;
        request["body"]["approximate_latitude"] = approximate_latitude;
        request["body"]["approximate_longitude"] = approximate_longitude;
        request["body"]["bearing_in_radians"] = bearing_in_radians;
        request["body"][
          "approximate_distance_in_km"
        ] = approximate_distance_in_km;
      } else if (responseFromApproximateCoordinates.success === false) {
        return responseFromApproximateCoordinates;
      }

      let generated_name = null;
      let requestBodyForCreatingSite = {};

      let isNameValid = createSite.validateSiteName(name);
      if (!isNameValid) {
        return {
          success: false,
          message: "site name is invalid, please check documentation",
        };
      }

      let lat_long = createSite.generateLatLong(latitude, longitude);
      request["body"]["lat_long"] = lat_long;

      let responseFromGenerateName = await createSite.generateName(tenant);
      logObject("responseFromGenerateName", responseFromGenerateName);
      if (responseFromGenerateName.success === true) {
        generated_name = responseFromGenerateName.data;
        request["body"]["generated_name"] = generated_name;
      } else if (responseFromGenerateName.success === false) {
        return responseFromGenerateName;
      }

      let responseFromGenerateMetadata = await createSite.generateMetadata(
        request
      );
      logObject("responseFromGenerateMetadata", responseFromGenerateMetadata);
      if (responseFromGenerateMetadata.success === true) {
        requestBodyForCreatingSite = responseFromGenerateMetadata.data;
      } else if (responseFromGenerateMetadata.success === false) {
        return responseFromGenerateMetadata;
      }

      const responseFromCreateSite = await SiteModel(tenant).register(
        requestBodyForCreatingSite
      );

      logObject("responseFromCreateSite in the util", responseFromCreateSite);

      if (responseFromCreateSite.success === true) {
        let createdSite = responseFromCreateSite.data;
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.SITES_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(createdSite),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logObject("error", error);
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromCreateSite;
      } else if (responseFromCreateSite.success === false) {
        return responseFromCreateSite;
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (tenant, filter, update) => {
    try {
      const responseFromModifySite = await SiteModel(tenant).modify({
        filter,
        update,
      });

      return responseFromModifySite;
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "create site util server error -- update",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
      logger.error(`internal server error -- sanitiseName-- ${error.message}`);
    }
  },
  getRoadMetadata: async (latitude, longitude) => {
    try {
      let response = {};
      let promises = [];
      const today = monthsInfront(0);
      const oneMonthAgo = monthsInfront(-1);
      const endDate = generateDateFormatWithoutHrs(today);
      const startDate = generateDateFormatWithoutHrs(oneMonthAgo);
      const paths = constants.GET_ROAD_METADATA_PATHS;
      const arrayOfPaths = Object.entries(paths);
      for (const [key, path] of arrayOfPaths) {
        const url = constants.GET_ROAD_METADATA({
          path,
          latitude,
          longitude,
          startDate,
          endDate,
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
              try {
                logger.error(
                  `internal server error -- ${JSON.stringify(error)}`
                );
              } catch (error) {
                logger.error(`internal server error -- ${error.message}`);
              }
              return {
                success: false,
                errors: { message: error },
                message: "Internal Server Error",
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
            status: httpStatus.OK,
            data: response,
          };
        } else if (isEmpty(response)) {
          return {
            success: false,
            message: "unable to retrieve any road metadata",
            status: httpStatus.NOT_FOUND,
            errors: { message: "unable to retrieve any road metadata" },
          };
        }
      });
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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

      // logger.info(`the body sent to generate metadata -- ${body}`);

      let responseFromGetAltitude = await createSite.getAltitude(
        latitude,
        longitude
      );

      // logger.info(`responseFromGetAltitude -- ${responseFromGetAltitude}`);
      if (responseFromGetAltitude.success === true) {
        altitudeResponseData["altitude"] = responseFromGetAltitude.data;
      } else if (responseFromGetAltitude.success === false) {
        let errors = responseFromGetAltitude.errors
          ? responseFromGetAltitude.errors
          : { message: "" };
        try {
          logger.error(
            `unable to retrieve the altitude for this site, ${
              responseFromGetAltitude.message
            } and ${JSON.stringify(errors)}`
          );
        } catch (error) {
          logger.error(`internal server error ${error.message}`);
        }
      }

      // let responseFromGetRoadMetadata = await createSite.getRoadMetadata(
      //   latitude,
      //   longitude
      // );

      // logObject("responseFromGetRoadMetadata", responseFromGetRoadMetadata);

      // if (responseFromGetRoadMetadata.success === true) {
      //   roadResponseData = responseFromGetRoadMetadata.data;
      // } else if (responseFromGetRoadMetadata.success === false) {
      //   let errors = responseFromGetRoadMetadata.errors
      //     ? responseFromGetRoadMetadata.errors
      //     : {message:""};
      //   try {
      //     logger.error(
      //       `unable to retrieve the road metadata, ${
      //         responseFromGetRoadMetadata.message
      //       } and ${JSON.stringify(errors)} `
      //     );
      //   } catch (error) {
      //     logger.error(`internal server error -- ${error.message}`);
      //   }
      // }

      let responseFromReverseGeoCode = await createSite.reverseGeoCode(
        latitude,
        longitude
      );
      // logger.info(
      //   `responseFromReverseGeoCode -- ${responseFromReverseGeoCode}`
      // );
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
          data_provider: constants.DATA_PROVIDER_MAPPINGS(body.network),
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
      } else if (responseFromReverseGeoCode.success === false) {
        return responseFromReverseGeoCode;
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
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

      const responseFromListSite = await SiteModel(tenant).list({
        filter,
      });
      if (responseFromListSite.success === true) {
        let siteDetails = { ...responseFromListSite.data[0] };
        request["body"] = siteDetails;
        delete request.body._id;
        delete request.body.devices;
      } else if (responseFromListSite.success === false) {
        return responseFromListSite;
      }

      // logger.info(`refresh -- responseFromListSite -- ${responseFromListSite}`);

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
        let availableName = createSite.pickAvailableValue(siteNames);
        let isNameValid = createSite.validateSiteName(availableName);
        if (!isNameValid) {
          let sanitisedName = createSite.sanitiseName(availableName);
          request["body"]["name"] = sanitisedName;
        }
        request["body"]["name"] = availableName;
      }

      let lat_long = createSite.generateLatLong(latitude, longitude);
      request["body"]["lat_long"] = lat_long;

      if (isEmpty(request["body"]["generated_name"])) {
        let responseFromGenerateName = await createSite.generateName(tenant);
        logObject("responseFromGenerateName", responseFromGenerateName);
        if (responseFromGenerateName.success === true) {
          generated_name = responseFromGenerateName.data;
          request["body"]["generated_name"] = generated_name;
        } else if (responseFromGenerateName.success === false) {
          return responseFromGenerateName;
        }
      }

      let requestForAirQloudsAndWeatherStations = {};
      requestForAirQloudsAndWeatherStations["query"] = {};
      requestForAirQloudsAndWeatherStations["query"]["tenant"] = tenant;
      requestForAirQloudsAndWeatherStations["query"]["id"] = id;
      let responseFromFindAirQlouds = await createSite.findAirQlouds(
        requestForAirQloudsAndWeatherStations
      );

      logObject("responseFromFindAirQlouds", responseFromFindAirQlouds);
      if (responseFromFindAirQlouds.success === true) {
        request["body"]["airqlouds"] = responseFromFindAirQlouds.data;
      } else if (responseFromFindAirQlouds.success === false) {
        logObject(
          "responseFromFindAirQlouds was unsuccessful",
          responseFromFindAirQlouds
        );
      }

      const responseFromNearestWeatherStation = await createSite.findNearestWeatherStation(
        requestForAirQloudsAndWeatherStations
      );

      if (responseFromNearestWeatherStation.success === true) {
        let nearest_tahmo_station = responseFromNearestWeatherStation.data;
        delete nearest_tahmo_station.elevation;
        delete nearest_tahmo_station.countrycode;
        delete nearest_tahmo_station.timezoneoffset;
        delete nearest_tahmo_station.name;
        delete nearest_tahmo_station.type;
        request["body"]["nearest_tahmo_station"] = nearest_tahmo_station;
      } else if (responseFromNearestWeatherStation.success === false) {
        logObject(
          "unable to find the nearest weather station",
          responseFromNearestWeatherStation
        );
      }

      // if (
      //   !isEmpty(request["body"]["site_codes"]) &&
      //   request["body"]["site_codes"].length < 7
      // ) {
      //   const siteCodeValues = [
      //     "site_id",
      //     "name",
      //     "_id",
      //     "lat_long",
      //     "generated name",
      //     "location_name",
      //     "search_name",
      //     "formatted_name",
      //   ];

      //   for (const siteCode of siteCodeValues) {
      //     request["body"]["site_codes"].push(siteCode);
      //   }
      // }

      request["query"]["tenant"] = tenant;
      let responseFromGenerateMetadata = await createSite.generateMetadata(
        request
      );

      // logger.info(
      //   `refresh -- responseFromGenerateMetadata-- ${responseFromGenerateMetadata}`
      // );

      if (responseFromGenerateMetadata.success === true) {
        update = responseFromGenerateMetadata.data;
      } else if (responseFromGenerateMetadata.success === false) {
        return responseFromGenerateMetadata;
      }

      // logger.info(`refresh -- update -- ${update}`);

      let responseFromModifySite = await createSite.update(
        tenant,
        filter,
        update
      );

      // logger.info(
      //   `refresh -- responseFromModifySite -- ${responseFromModifySite} `
      // );

      if (responseFromModifySite.success === true) {
        return {
          success: true,
          message: "Site details successfully refreshed",
          data: responseFromModifySite.data,
        };
      } else if (responseFromModifySite.success === false) {
        return responseFromModifySite;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        errors: { message: error.message },
        message: "Internal Server Error",
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (tenant, filter) => {
    try {
      return {
        success: false,
        message: "feature temporarity disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const responseFromRemoveSite = await SiteModel(tenant).remove({
        filter,
      });

      return responseFromRemoveSite;
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "delete Site util server error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async ({ tenant, filter, skip, limit }) => {
    try {
      const responseFromListSite = await SiteModel(tenant).list({
        filter,
        limit,
        skip,
      });

      if (responseFromListSite.success === false) {
        return responseFromListSite;
      } else if (responseFromListSite.success === true) {
        let modifiedResponseFromListSite = responseFromListSite;
        modifiedResponseFromListSite.data = responseFromListSite.data.filter(
          function(obj) {
            return obj.lat_long !== "4_4";
          }
        );
        return modifiedResponseFromListSite;
      }
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  formatSiteName: (name) => {
    try {
      let nameWithoutWhiteSpace = name.replace(/\s/g, "");
      return nameWithoutWhiteSpace.toLowerCase();
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
          retrievedAddress.search_name = object.long_name;
        }
        retrievedAddress.formatted_name = formatted_name;
        retrievedAddress.geometry = geometry;
        retrievedAddress.site_tags = types;
        retrievedAddress.google_place_id = google_place_id;
        retrievedAddress.location_name =
          retrievedAddress.country !== "Uganda"
            ? `${retrievedAddress.region}, ${retrievedAddress.country}`
            : `${retrievedAddress.district}, ${retrievedAddress.country}`;
        if (!retrievedAddress.search_name) {
          retrievedAddress.search_name = retrievedAddress.town
            ? retrievedAddress.town
            : retrievedAddress.street
            ? retrievedAddress.street
            : retrievedAddress.city
            ? retrievedAddress.city
            : retrievedAddress.district;
        }
      });
      return {
        success: true,
        message: "retrieved the Google address details of this site",
        data: retrievedAddress,
      };
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "unable to transform the address",
        errors: { message: e.message },
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
            let responseFromTransformAddress = createSite.retrieveInformationFromAddress(
              responseJSON
            );
            return responseFromTransformAddress;
          } else {
            return {
              success: false,
              message: "unable to get the site address details",
              status: httpStatus.NOT_FOUND,
              errors: {
                message:
                  "review the GPS coordinates provided, we cannot get corresponding metadata",
              },
            };
          }
        })
        .catch((error) => {
          try {
            logger.error(`internal server error -- ${JSON.stringify(error)}`);
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return {
            success: false,
            errors: { message: error },
            message: "constants server side error",
          };
        });
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "unable to get the address values",
        errors: { message: e.message },
      };
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
            status: httpStatus.OK,
          };
        })
        .catch((e) => {
          try {
            logger.error(`internal server error -- ${JSON.stringify(e)}`);
          } catch (error) {
            logger.error(`internal server error -- ${error.message}`);
          }
          return {
            success: false,
            message: "get altitude server error",
            errors: { message: e },
            status: httpStatus.BAD_GATEWAY,
          };
        });
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
      return {
        success: false,
        message: "get altitude server error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  generateLatLong: (lat, long) => {
    try {
      return `${lat}_${long}`;
    } catch (e) {
      logger.error(`internal server error -- ${e.message}`);
    }
  },
  findNearestSitesByCoordinates: async (request) => {
    try {
      let { radius, latitude, longitude, tenant } = request;
      const responseFromListSites = await createSite.list({
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
            let distanceBetweenTwoPoints = distanceUtil.distanceBtnTwoPoints(
              latitude,
              longitude,
              site["latitude"],
              site["longitude"]
            );

            if (distanceBetweenTwoPoints < radius) {
              site["distance"] = distanceBetweenTwoPoints;
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
      } else if (responseFromListSites.success === false) {
        return responseFromListSites;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  createApproximateCoordinates: ({
    latitude,
    longitude,
    approximate_distance_in_km,
    bearing,
  }) => {
    try {
      const responseFromDistanceUtil = distanceUtil.createApproximateCoordinates(
        {
          latitude,
          longitude,
          approximate_distance_in_km,
          bearing,
        }
      );

      return {
        success: true,
        data: responseFromDistanceUtil,
        message: "successfully approximated the GPS coordinates",
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      };
    }
  },
};

module.exports = createSite;
