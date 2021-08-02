const SiteSchema = require("../models/Site");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const jsonify = require("./jsonify");
const axios = require("axios");
const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});
const axiosInstance = () => {
  return axios.create();
};
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const { request } = require("express");
const logger = log4js.getLogger("create-site-util");

const { kafkaProducer } = require("../controllers/kafka-producer");
const { TOPICS } = require("./kafka-topics");

const SiteModel = (tenant) => {
  getModelByTenant(tenant.toLowerCase(), "site", SiteSchema);
};

const manageSite = {
  hasWhiteSpace: (name) => {
    try {
      return name.indexOf(" ") >= 0;
    } catch (e) {
      logger.error(`server error -- ${e.message}`);
    }
  },

  checkStringLength: (name) => {
    try {
      let length = name.length;
      if (length >= 4 && length <= 15) {
        return true;
      }
      return false;
    } catch (e) {
      logger.error(`server error -- ${e.message}`);
    }
  },

  validateSiteName: (name) => {
    try {
      let nameHasWhiteSpace = manageSite.hasWhiteSpace(name);
      let isValidStringLength = manageSite.checkStringLength(name);
      if (!nameHasWhiteSpace && isValidStringLength) {
        return true;
      }
      return false;
    } catch (e) {
      logger.error(`server error -- ${e.message}`);
    }
  },

  generateName: async (tenant) => {
    try {
      let filter = {
        lat_long: "4_4",
      };
      let responseFromListSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).list({
        tenant,
        filter,
      });
      if (responseFromListSite.success == false) {
        if (responseFromListSite.error) {
          return {
            success: false,
            message: responseFromListSite.message,
            error: responseFromListSite.error,
          };
        } else {
          return {
            success: false,
            message: responseFromListSite.message,
          };
        }
      }
      let update = {
        $inc: { count: 1 },
      };
      let responseFromUpdateSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).modify({
        filter,
        update,
      });
      if (responseFromUpdateSite.success == true) {
        let count = responseFromUpdateSite.data.count;
        let siteName = `site_${count}`;
        return {
          success: true,
          message: "successfully generated the unique site name",
          data: siteName,
        };
      } else if (responseFromUpdateSite.success == false) {
        if (responseFromUpdateSite.error) {
          return {
            success: false,
            message: responseFromUpdateSite.message,
            error: responseFromUpdateSite.error,
          };
        } else {
          return {
            success: false,
            message: responseFromUpdateSite.message,
          };
        }
      }
    } catch (e) {
      logger.error(`generateName util server error -- ${e.message}`);
      return {
        success: false,
        error: e.message,
        message: "generateName util server error",
      };
    }
  },

  create: async (tenant, req) => {
    try {
      let { body } = req;
      let request = {};
      request["body"] = body;
      let { name, latitude, longitude } = body;
      let generated_name = null;
      let requestBodyForCreatingSite = {};

      /**
       * could move this name validation to the route level
       * using a custom validator
       */
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
      }

      if (responseFromGenerateName.success === false) {
        let error = responseFromGenerateName.error
          ? responseFromGenerateName.error
          : "";
        return {
          success: false,
          message: responseFromGenerateName.message,
          error,
        };
      }

      let responseFromGenerateMetadata = await manageSite.generateMetadata(
        tenant,
        request
      );
      logObject("responseFromGenerateMetadata", responseFromGenerateMetadata);
      if (responseFromGenerateMetadata.success === true) {
        requestBodyForCreatingSite = responseFromGenerateMetadata.data;
      }

      if (responseFromGenerateMetadata.success === false) {
        let error = responseFromGenerateMetadata.error
          ? responseFromGenerateMetadata.error
          : "";
        return {
          success: false,
          message: responseFromGenerateMetadata.message,
          error,
        };
      }

      let responseFromCreateSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).register(requestBodyForCreatingSite);

      if (responseFromCreateSite.success === true) {
        let createdSite = responseFromCreateSite.data;
        let jsonifyCreatedSite = jsonify(createdSite);

        // Send Site data to kafka to add distances
        try{
          kafkaProducer(TOPICS.COMPUTE_SITE_DISTANCES, [createdSite]);
        }catch (error) {
          logObject('Error sending site details to kafka', error)
        }

        return {
          success: true,
          message: "Site successfully created",
          data: jsonifyCreatedSite,
        };
      }

      if (responseFromCreateSite.success === false) {
        let error = responseFromCreateSite.error
          ? responseFromCreateSite.error
          : "";
        return {
          success: false,
          message: responseFromCreateSite.message,
          error,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "create site util server error",
        error: e.message,
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
      if (responseFromModifySite.success == true) {
        return {
          success: true,
          message: responseFromModifySite.message,
          data: responseFromModifySite.data,
        };
      } else if (responseFromModifySite.success == false) {
        if (responseFromModifySite.error) {
          return {
            success: false,
            message: responseFromModifySite.message,
            error: responseFromModifySite.error,
          };
        } else {
          return {
            success: false,
            message: responseFromModifySite.message,
          };
        }
      }
    } catch (e) {
      logElement("update Sites util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },

  sanitiseName: (name) => {
    try {
      let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
      let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
      let trimmedName = shortenedName.trim();
      return trimmedName;
    } catch (error) {
      logger.error(`sanitiseName -- ${error.message}`);
    }
  },

  generateMetadata: async (tenant, req) => {
    try {
      let { latitude, longitude } = req.body;
      let body = req.body;

      logger.info(
        `the body sent to generate metadata -- ${JSON.stringify(req.body)}`
      );

      let responseFromGetAltitude = await manageSite.getAltitude(
        latitude,
        longitude
      );

      logger.info(
        `responseFromGetAltitude -- ${JSON.stringify(responseFromGetAltitude)}`
      );
      if (responseFromGetAltitude.success === true) {
        body.altitude = responseFromGetAltitude.data;
      }

      let responseFromReverseGeoCode = await manageSite.reverseGeoCode(
        latitude,
        longitude
      );
      logger.info(
        `responseFromReverseGeoCode -- ${JSON.stringify(
          responseFromReverseGeoCode
        )}`
      );
      if (responseFromReverseGeoCode.success === true) {
        let google_site_tags = responseFromReverseGeoCode.data.site_tags;
        let existing_site_tags = body.site_tags ? body.site_tags : [];
        let merged_site_tags = [...google_site_tags, ...existing_site_tags];
        body["site_tags"] = merged_site_tags;
        let requestBody = { ...responseFromReverseGeoCode.data, ...body };
        return {
          success: true,
          message: "successfully generated the metadata",
          data: requestBody,
        };
      }

      if (responseFromReverseGeoCode.success === false) {
        let error = responseFromReverseGeoCode.error
          ? responseFromReverseGeoCode.error
          : "";
        return {
          success: false,
          message: responseFromReverseGeoCode.message,
          error,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "create site util server error",
        error: e.message,
      };
    }
  },

  pickAvailableValue: (valuesInObject) => {
    let arrayOfSiteNames = Object.values(valuesInObject);
    let availableName = arrayOfSiteNames.find(Boolean);
    return availableName;
  },

  refresh: async (tenant, req) => {
    let filter = generateFilter.sites(req);
    let update = {};
    let request = {};
    let generated_name = null;
    logObject("the filter being used to filter", filter);

    let responseFromListSite = await getModelByTenant(
      tenant.toLowerCase(),
      "site",
      SiteSchema
    ).list({
      filter,
    });

    logger.info(
      `refresh -- responseFromListSite -- ${JSON.stringify(
        responseFromListSite
      )}`
    );

    let siteDetails = { ...responseFromListSite[0] };
    request["body"] = siteDetails;
    delete siteDetails._id;
    delete siteDetails.devices;

    let { name, parish, county, district, latitude, longitude } = siteDetails;

    /**
     * we could move all these name vaslidations and
     * sanitisations to the api route level before
     * coming to to the utils
     */
    if (!name) {
      let siteNames = { name, parish, county, district };
      let availableName = manageSite.pickAvailableValue(siteNames);
      let isNameValid = manageSite.validateSiteName(availableName);
      if (!isNameValid) {
        let sanitisedName = manageSite.sanitiseName(availableName);
        siteDetails["name"] = sanitisedName;
      }
      siteDetails["name"] = availableName;
    }

    let lat_long = manageSite.generateLatLong(latitude, longitude);

    if (isEmpty(siteDetails.generated_name)) {
      let responseFromGenerateName = await manageSite.generateName(tenant);
      logObject("responseFromGenerateName", responseFromGenerateName);
      if (responseFromGenerateName.success === true) {
        generated_name = responseFromGenerateName.data;
        request["body"]["generated_name"] = generated_name;
      }
      if (responseFromGenerateName.success === false) {
        let error = responseFromGenerateName.error
          ? responseFromGenerateName.error
          : "";
        return {
          success: false,
          message: responseFromGenerateName.message,
          error,
        };
      }
    }

    request["body"]["lat_long"] = lat_long;

    let responseFromGenerateMetadata = await manageSite.generateMetadata(
      tenant,
      request
    );

    logger.info(
      `refresh -- responseFromGenerateMetadata-- ${JSON.stringify(
        responseFromGenerateMetadata
      )}`
    );

    if (responseFromGenerateMetadata.success === true) {
      update = responseFromGenerateMetadata.data;
    }

    logObject("the update", update);

    logger.info(`refresh -- update -- ${JSON.stringify(update)}`);

    let responseFromModifySite = await manageSite.update(
      tenant,
      filter,
      update
    );

    logger.info(
      `refresh -- responseFromModifySite -- ${JSON.stringify(
        responseFromModifySite
      )} `
    );

    if (responseFromModifySite.success === true) {
      return {
        success: true,
        message: "Site details successfully refreshed",
        data: responseFromModifySite.data,
      };
    }

    if (responseFromModifySite.success === false) {
      let error = responseFromModifySite.error
        ? responseFromModifySite.error
        : "";
      return {
        success: false,
        message: responseFromModifySite.message,
        error,
      };
    }

    if (responseFromGenerateMetadata.success === false) {
      let error = responseFromGenerateMetadata.error
        ? responseFromGenerateMetadata.error
        : "";
      return {
        success: false,
        message: responseFromGenerateMetadata.message,
        error,
      };
    }

    if (responseFromListSite.success === false) {
      let error = responseFromListSite.error ? responseFromListSite.error : "";
      return {
        success: false,
        message: responseFromListSite.message,
        error,
      };
    }
  },

  delete: async (tenant, filter) => {
    try {
      let responseFromRemoveSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).remove({
        filter,
      });
      if (responseFromRemoveSite.success == true) {
        return {
          success: true,
          message: responseFromRemoveSite.message,
          data: responseFromRemoveSite.data,
        };
      } else if (responseFromRemoveSite.success == false) {
        if (responseFromRemoveSite.error) {
          return {
            success: false,
            message: responseFromRemoveSite.message,
            error: responseFromRemoveSite.error,
          };
        } else {
          return {
            success: false,
            message: responseFromRemoveSite.message,
          };
        }
      }
    } catch (e) {
      logElement("delete Site util", e.message);
      return {
        success: false,
        message: "delete Site util server error",
        error: e.message,
      };
    }
  },
  list: async ({ tenant, filter, _skip, _limit }) => {
    try {
      let responseFromListSite = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      ).list({
        filter,
        _limit,
        _skip,
      });
      if (responseFromListSite.success == false) {
        if (responseFromListSite.error) {
          return {
            success: false,
            message: responseFromListSite.message,
            error: responseFromListSite.error,
          };
        } else {
          return {
            success: false,
            message: responseFromListSite.message,
          };
        }
      } else {
        data = responseFromListSite.filter(function(obj) {
          return obj.lat_long !== "4_4";
        });
        return {
          success: true,
          message: "successfully listed the site(s)",
          data,
        };
      }
    } catch (e) {
      logElement("list Sites util", e.message);
      return {
        success: false,
        message: "list Sites util server error",
        error: e.message,
      };
    }
  },

  formatSiteName: (name) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
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
        error: e.message,
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
          if (responseJSON) {
            let responseFromTransformAddress = manageSite.retrieveInformationFromAddress(
              responseJSON
            );
            if (responseFromTransformAddress.success == true) {
              return {
                success: true,
                data: responseFromTransformAddress.data,
                message: responseFromTransformAddress.message,
              };
            } else if (responseFromTransformAddress.success == false) {
              if (responseFromTransformAddress.error) {
                return {
                  success: false,
                  error: responseFromTransformAddress.error,
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
            };
          }
        })
        .catch((error) => {
          return {
            success: false,
            error: error.message,
            message: "constants server side error",
          };
        });
    } catch (e) {
      return {
        success: false,
        message: "unable to get the address values",
        error: e.message,
      };
    }
  },

  getDistance: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  getLandform: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
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
          console.log(r.data.results[0].elevation);
          return {
            success: true,
            message: "successfully retrieved the altitude details",
            data: r.data.results[0].elevation,
          };
        })
        .catch((e) => {
          logElement("get altitude server error", e.message);
          return {
            success: false,
            message: "get altitude server error",
            error: e,
          };
        });
    } catch (e) {
      logElement("server error", e.message);
      return {
        success: false,
        message: "get altitude server error",
        error: e.message,
      };
    }
  },

  getTrafficFactor: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  getGreenness: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  getTerrain: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  getAspect: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  getRoadIntesity: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  getRoadStatus: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  getLandUse: (lat, long) => {
    try {
    } catch (e) {
      logElement("server error", e.message);
    }
  },

  generateLatLong: (lat, long) => {
    try {
      return `${lat}_${long}`;
    } catch (e) {
      logElement("server error", e.message);
    }
  },
};

module.exports = manageSite;
