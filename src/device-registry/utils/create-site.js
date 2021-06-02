const SiteModel = require("../models/Site");
const constants = require("../config/constants");

const createSiteUtils = {
  hasWhiteSpace: (name) => {
    return name.indexOf(" ") >= 0;
  },

  checkStringLength: (name) => {
    let length = name.length;
    if (length >= 4 && length <= 15) {
      return true;
    }
    return false;
  },

  validateSiteName: (name) => {
    let nameHasWhiteSpace = this.hasWhiteSpace(name);
    let isValidStringLength = this.checkStringLength(name);
    if (!nameHasWhiteSpace && isValidStringLength) {
      return true;
    }
    return false;
  },

  createSite: async (tenant, lat, long, name) => {
    try {
      let body = { latitude: lat, longitude: long, name };
      /**
       * need to add more data to the request body from here
       */
      let createdSite = await SiteModel(tenant.toLowerCase()).create(body);
      if (createdSite) {
        return {
          success: true,
          message: "successfully created a site",
        };
      } else {
        return {
          success: false,
          message: "unable to create a site",
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "unable to create a site",
        error: e.message,
      };
    }
  },

  updateSite: async (tenant, lat_long, body) => {
    try {
      let filter = { lat_long },
        update = body,
        options = { upsert: true };
      let updatedSite = await SiteModel(tenant.toLowerCase()).update(
        filter,
        update,
        options
      );
      if (updatedSite) {
        return {
          success: true,
          message: "successfully updated the site",
          updatedSite,
        };
      } else {
        return {
          success: false,
          message: "unable to update the site",
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "unable to update the site",
        error: e.message,
      };
    }
  },

  deleteSite: async (tenant, lat_long) => {
    try {
      let filter = { lat_long };
      let deletedSite = await SiteModel(tenant.toLowerCase()).delete(filter);
      if (deletedSite) {
        return {
          success: true,
          message: "successfully deleted the site",
          deletedSite,
        };
      } else {
        return {
          success: false,
          message: "unable to delete the site",
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "unable to delete the site",
        error: e.message,
      };
    }
  },
  getSite: async (tenant, filter, skip, limit) => {
    try {
      options = {};
      let siteDetails = await SiteModel(tenant.toLowerCase()).list(
        filter,
        skip,
        limit
      );
      if (siteDetails) {
        return {
          success: true,
          message: "successfully listed the site details",
          siteDetails,
        };
      } else {
        return {
          success: false,
          message: "unable to retrieve site details",
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "unable to retrieve site details",
        error: e.message,
      };
    }
  },

  formatSiteName: (name) => {},

  transformAddress: (address) => {
    try {
      let address_components = address.results[0].address_components;
      let formatted_name = address.results[0].formatted_address;
      let geometry = address.results[0].geometry;
      let transformedAddress = {};
      address_components.forEach((object) => {
        if (object.types.includes("locality", "administrative_area_level_3")) {
          transformedAddress.town = object.long_name;
          transformedAddress.city = object.long_name;
        }
        if (object.types.includes("administrative_area_level_2")) {
          transformedAddress.district = object.long_name;
          transformedAddress.county = object.long_name;
        }
        if (object.types.includes("administrative_area_level_1")) {
          transformedAddress.region = object.long_name;
        }
        if (object.types.includes("route")) {
          transformedAddress.street = object.long_name;
        }
        if (object.types.includes("country")) {
          transformedAddress.country = object.long_name;
        }
        transformedAddress.formatted_name = formatted_name;
        transformedAddress.geometry = geometry;
      });
      return {
        success: true,
        message: "received the address values of this site",
        address: transformedAddress,
      };
    } catch (e) {
      return {
        success: false,
        message: "unable to transform the address",
        error: e.message,
      };
    }
  },

  reverseGeoCode: (lat, long) => {
    try {
      let address = constants.GET_ADDRESS(lat, long);
      if (address) {
        let responseFromTransformAddress = this.transformAddress(address);
        return responseFromTransformAddress;
      } else {
        return {
          success: false,
          message: "unable to get the address values",
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "unable to get the address values",
        error: e.message,
      };
    }
  },

  getDistance: (lat, long) => {},

  getLandform: (lat, long) => {},

  getAltitude: (lat, long) => {},

  getTrafficFactor: (lat, long) => {},

  getGreenness: (lat, long) => {},

  getTerrain: (lat, long) => {},

  getAspect: (lat, long) => {},

  getRoadIntesity: (lat, long) => {},

  getRoadStatus: (lat, long) => {},

  getLandUse: (lat, long) => {},

  generateLatLong: (lat, long) => {
    return `${lat}_${long}`;
  },
};

module.exports = createSiteUtils;
