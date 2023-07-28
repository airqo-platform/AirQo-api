const LocationHistorySchema = require("@models/LocationHistory");
const UserSchema = require("@models/User");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const { getModelByTenant } = require("@config/database");
const { logObject, logElement, logText, winstonLogger } = require("@utils/log");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

const log4js = require("log4js");
const { log } = require("firebase-functions/logger");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-location-history-util`
);

const LocationHistoryModel = (tenant) => {
  try {
    let locationHistories = mongoose.model("locationHistories");
    return locationHistories;
  } catch (error) {
    let locationHistories = getModelByTenant(
      tenant,
      "locationHistory",
      LocationHistorySchema
    );
    return locationHistories;
  }
};

const locationHistories = {
  sample: async (request) => {
    try {
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /******* location Histories *******************************************/
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.location_histories(request);
      if (filter.success === false) {
        return filter;
      }

      const responseFromListLocationHistoriesPromise = LocationHistoryModel(
        tenant.toLowerCase()
      ).list({ filter });
      const responseFromListLocationHistories =
        await responseFromListLocationHistoriesPromise;
      return responseFromListLocationHistories;
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

  delete: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.location_histories(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromDeleteLocationHistories = await LocationHistoryModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      return responseFromDeleteLocationHistories;
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

  update: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const update = body;
      const filter = generateFilter.location_histories(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromUpdateLocationHistories = await LocationHistoryModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateLocationHistories;
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

  create: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      /**
       * check for edge cases?
       */

      const responseFromCreateLocationHistory = await LocationHistoryModel(
        tenant.toLowerCase()
      ).register(body);
      return responseFromCreateLocationHistory;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  syncLocationHistories: async (request) => {
    try {
      const { query, body, params } = request;
      const { tenant } = query;
      const { location_histories } = body;
      const { firebase_user_id } = params;

      let responseFromCreateLocationHistories, responseFromLocationHistories;
      let filter = {
        firebase_user_id: firebase_user_id,
      };

      let unsynced_location_histories = (
        await LocationHistoryModel(tenant.toLowerCase()).list({ filter })
      ).data;

      unsynced_location_histories = unsynced_location_histories.map((item) => {
        delete item._id;
        return item;
      });

      const missing_location_histories = location_histories.filter((item) => {
        const found = unsynced_location_histories.some((location_history) => {
          return (
            location_history.place_id === item.place_id &&
            location_history.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      if (missing_location_histories.length === 0) {
        responseFromCreateLocationHistories = {
          success: true,
          message: "No missing Location History ",
          data: [],
        };
      }

      for (let location_history in missing_location_histories) {
        responseFromCreateLocationHistories = await LocationHistoryModel(
          tenant.toLowerCase()
        ).register(missing_location_histories[location_history]);
      }

      let synchronizedLocationHistories = (
        await LocationHistoryModel(tenant.toLowerCase()).list({ filter })
      ).data;

      if (responseFromCreateLocationHistories.success === false) {
        return {
          success: false,
          message: "Error Synchronizing Location Histories",
          errors: {
            message: `Response from Create Location History: ${responseFromCreateLocationHistories.errors.message}`,
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      return {
        success: true,
        message: "Location Histories Synchronized",
        data: synchronizedLocationHistories,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = locationHistories;
