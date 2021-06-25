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

const SiteModel = (tenant) => {
  getModelByTenant(tenant.toLowerCase(), "site", SiteSchema);
};

const manageSite = {
  hasWhiteSpace: (name) => {
    try {
      return name.indexOf(" ") >= 0;
    } catch (e) {
      logElement("server error", e.message);
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
      logElement("server error", e.message);
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
      logElement("server error", e.message);
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
      return {
        success: false,
        error: e.message,
        message: "generateName util server error",
      };
    }
  },

  create: async (tenant, req) => {
    try {
      let { latitude, longitude, name, site_tags } = req.body;
      let body = req.body;
      let isNameValid = manageSite.validateSiteName(name);
      let lat_long = manageSite.generateLatLong(latitude, longitude);
      body["lat_long"] = lat_long;
      if (!isNameValid) {
        return {
          success: false,
          message: "site name is invalid, please check documentation",
        };
      }
      let responseFromGenerateName = await manageSite.generateName(tenant);
      logObject("responseFromGenerateName", responseFromGenerateName);

      let responseFromGetAltitude = await manageSite.getAltitude(
        latitude,
        longitude
      );
      logObject("responseFromGetAltitude", responseFromGetAltitude);
      if (responseFromGetAltitude.success == true) {
        body.altitude = responseFromGetAltitude.data;
      }

      if (responseFromGenerateName.success == true) {
        body.generated_name = responseFromGenerateName.data;

        let responseFromReverseGeoCode = await manageSite.reverseGeoCode(
          latitude,
          longitude
        );
        logObject("responseFromReverseGeoCode", responseFromReverseGeoCode);
        if (responseFromReverseGeoCode.success == true) {
          let requestBody = { ...responseFromReverseGeoCode.data, ...body };
          let responseFromCreateSite = await getModelByTenant(
            tenant.toLowerCase(),
            "site",
            SiteSchema
          ).register(requestBody);
          if (responseFromCreateSite.success == true) {
            let createdSite = responseFromCreateSite.data;
            let jsonifyCreatedSite = jsonify(createdSite);
            return {
              success: true,
              message: "Site successfully created",
              data: jsonifyCreatedSite,
            };
          }
          if (responseFromCreateSite.success == false) {
            if (responseFromCreateSite.error) {
              return {
                success: false,
                message: responseFromCreateSite.message,
                error: responseFromCreateSite.error,
              };
            } else {
              return {
                success: false,
                message: responseFromCreateSite.message,
              };
            }
          }
        } else if (responseFromReverseGeoCode.success == false) {
          if (responseFromReverseGeoCode.error) {
            return {
              success: false,
              message: responseFromReverseGeoCode.message,
              error: responseFromReverseGeoCode.error,
            };
          } else {
            return {
              success: false,
              message: responseFromReverseGeoCode.message,
            };
          }
        }
      } else if (responseFromGenerateName.success == false) {
        if (responseFromGenerateName.error) {
          return {
            success: false,
            message: responseFromGenerateName.message,
            error: responseFromGenerateName.error,
          };
        } else {
          return {
            success: false,
            message: responseFromGenerateName.message,
          };
        }
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
      logObject("responseFromListSite in util", responseFromListSite);
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
        return {
          success: true,
          message: "successfully listed the site(s)",
          data: responseFromListSite,
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
        retrievedAddress.$addToSet = { site_tags: { $each: types } };
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
