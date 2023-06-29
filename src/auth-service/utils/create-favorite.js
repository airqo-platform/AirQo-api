const FavoriteSchema = require("@models/Favorite");
const UserSchema = require("@models/User");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const { getModelByTenant } = require("@config/dbConnection");
const { logObject, logElement, logText, winstonLogger } = require("@utils/log");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

const log4js = require("log4js");
const { log } = require("firebase-functions/logger");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-favorite-util`
);

const UserModel = (tenant) => {
  try {
    let users = mongoose.model("users");
    return users;
  } catch (error) {
    let users = getModelByTenant(tenant, "user", UserSchema);
    return users;
  }
};

const FavoriteModel = (tenant) => {
  try {
    let favorites = mongoose.model("favorites");
    return favorites;
  } catch (error) {
    let favorites = getModelByTenant(tenant, "favorite", FavoriteSchema);
    return favorites;
  }
};

const favorites = {
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

  /******* favorites *******************************************/
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.favorites(request);
      if (filter.success === false) {
        return filter;
      }

      const responseFromListFavoritesPromise = FavoriteModel(
        tenant.toLowerCase()
      ).list({ filter });
      const responseFromListFavorites = await responseFromListFavoritesPromise;
      return responseFromListFavorites;
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
      const filter = generateFilter.favorites(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromDeleteFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      return responseFromDeleteFavorite;
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
      const filter = generateFilter.favorites(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromUpdateFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateFavorite;
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
      

      const responseFromCreateFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).register(body);
      return responseFromCreateFavorite;
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

module.exports = favorites;
