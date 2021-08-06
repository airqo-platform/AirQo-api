const AirQloudSchema = require("../models/AirQloud");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const jsonify = require("./jsonify");
const axios = require("axios");
const axiosInstance = () => {
  return axios.create();
};
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const { request } = require("express");
const logger = log4js.getLogger("create-airqloud-util");

const createAirqloud = {
  create: async (request) => {
    let { body } = request;
    let { tenant } = request.query;

    let responseFromCreateAirQloud = await getModelByTenant(
      tenant.toLowerCase(),
      "airqloud",
      AirQloudSchema
    ).create(body);

    if (responseFromCreateAirQloud.success === true) {
      return {
        success: true,
        message: responseFromCreateAirQloud.message,
        data: responseFromCreateAirQloud.data,
      };
    }

    if (responseFromCreateAirQloud.success === false) {
      let error = responseFromCreateAirQloud.error
        ? responseFromCreateAirQloud.error
        : "";

      return {
        success: true,
        message: responseFromCreateAirQloud.message,
        error,
      };
    }
  },
  update: async (request) => {
    try {
      let { query } = request;
      let { body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.airqlouds(query);

      let responseFromModifyAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyAirQloud.success === true) {
        return {
          success: true,
          message: responseFromModifyAirQloud.message,
          data: responseFromModifyAirQloud.data,
        };
      }

      if (responseFromModifyAirQloud.success === false) {
        let error = responseFromModifyAirQloud.error
          ? responseFromModifyAirQloud.error
          : "";

        return {
          success: false,
          message: responseFromModifyAirQloud.message,
          error,
        };
      }
    } catch (e) {
      logElement("update AirQlouds util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },
  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.airqlouds(query);
      let responseFromRemoveAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).remove({
        filter,
      });
      if (responseFromRemoveAirQloud.success === true) {
        return {
          success: true,
          message: responseFromRemoveAirQloud.message,
          data: responseFromRemoveAirQloud.data,
        };
      }

      if (responseFromRemoveAirQloud.success === false) {
        let error = responseFromRemoveAirQloud.error
          ? responseFromRemoveAirQloud.error
          : "";

        return {
          success: false,
          message: responseFromRemoveAirQloud.message,
          error,
        };
      }
    } catch (e) {
      logElement("delete AirQloud util", e.message);
      return {
        success: false,
        message: "delete AirQloud util server error",
        error: e.message,
      };
    }
  },
  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = parseInt(query.limit, 0);
      const skip = parseInt(query.skip, 0);
      let filter = generateFilter.airqlouds(query);

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
        let error = responseFromListAirQloud.error
          ? responseFromListAirQloud.error
          : "";
        return {
          success: false,
          message: responseFromListAirQloud.message,
          error,
        };
      }

      if (responseFromListAirQloud.success === true) {
        data = responseFromListAirQloud.data;
        return {
          success: true,
          message: "successfully listed the site(s)",
          data,
        };
      }
    } catch (e) {
      logElement("list AirQlouds util", e.message);
      return {
        success: false,
        message: "list AirQlouds util server error",
        error: e.message,
      };
    }
  },
};

module.exports = createAirqloud;
