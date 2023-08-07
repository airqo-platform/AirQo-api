const FavoriteSchema = require("@models/Favorite");
const UserSchema = require("@models/User");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const { getModelByTenant } = require("@config/database");
const { logObject, logElement, logText } = require("@utils/log");
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

  syncFavorites: async (request) => {
    try {
      const { query, body, params } = request;
      const { tenant } = query;
      const { favorite_places } = body;
      const { firebase_user_id } = params;

      let responseFromCreateFavorite, responseFromDeleteFavorite;
      let filter = {
        firebase_user_id: firebase_user_id,
      };

      let unsynced_favorite_places = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter })
      ).data;

      unsynced_favorite_places = unsynced_favorite_places.map((item) => {
        delete item._id;
        return item;
      });

      if (favorite_places.length === 0) {
        for (let favorite in unsynced_favorite_places) {
          responseFromDeleteFavorite = await FavoriteModel(
            tenant.toLowerCase()
          ).remove({
            filter: unsynced_favorite_places[favorite],
          });
        }

        return {
          success: true,
          message: "No favorite places to sync",
          data: [],
        };
      }

      const missing_favorite_places = favorite_places.filter((item) => {
        const found = unsynced_favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            favorite.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      if (missing_favorite_places.length === 0) {
        responseFromCreateFavorite = {
          success: true,
          message: "No missing favorite places",
          data: [],
        };
      }

      for (let favorite in missing_favorite_places) {
        responseFromCreateFavorite = await FavoriteModel(
          tenant.toLowerCase()
        ).register(missing_favorite_places[favorite]);
        logObject("responseFromCreateFavorite", responseFromCreateFavorite);
      }

      const extra_favorite_places = unsynced_favorite_places.filter((item) => {
        const found = favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            favorite.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      if (extra_favorite_places.length === 0) {
        responseFromDeleteFavorite = {
          success: true,
          message: "No extra favorite places",
          data: [],
        };
      }

      for (let favorite in extra_favorite_places) {
        let filter = {
          firebase_user_id: favorite_places[0].firebase_user_id,
          place_id: extra_favorite_places[favorite].place_id,
        };
        responseFromDeleteFavorite = await FavoriteModel(
          tenant.toLowerCase()
        ).remove({
          filter,
        });
      }

      let synchronizedFavorites = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter })
      ).data;

      if (
        responseFromCreateFavorite.success === false &&
        responseFromDeleteFavorite.success === false
      ) {
        return {
          success: false,
          message: "Error Synchronizing favorites",
          errors: {
            message: `Response from Create Favorite: ${responseFromCreateFavorite.errors.message}
           + Response from Delete Favorite: ${responseFromDeleteFavorite.errors.message}`,
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      return {
        success: true,
        message: "Favorites Synchronized",
        data: synchronizedFavorites,
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

module.exports = favorites;
