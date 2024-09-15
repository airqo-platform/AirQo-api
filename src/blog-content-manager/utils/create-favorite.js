const FavoriteModel = require("@models/Favorite");
const httpStatus = require("http-status");
const { logObject } = require("@utils/log");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const { log } = require("firebase-functions/logger");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-favorite-util`
);
const { HttpError } = require("@utils/errors");

const favorites = {
  sample: async (request, next) => {
    try {
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******* favorites *******************************************/
  list: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.favorites(request, next);
      const responseFromListFavorites = await FavoriteModel(
        tenant.toLowerCase()
      ).list({ filter }, next);
      return responseFromListFavorites;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.favorites(request, next);
      const responseFromDeleteFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromDeleteFavorite;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const update = body;
      const filter = generateFilter.favorites(request, next);
      const responseFromUpdateFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateFavorite;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const responseFromCreateFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).register(body, next);
      return responseFromCreateFavorite;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  syncFavorites: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant, favorite_places, firebase_user_id } = {
        ...body,
        ...query,
        ...params,
      };
      let responseFromCreateFavorite, responseFromDeleteFavorite;
      let filter = {
        firebase_user_id: firebase_user_id,
      };

      let unsynced_favorite_places = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

      unsynced_favorite_places = unsynced_favorite_places.map((item) => {
        delete item._id;
        return item;
      });

      if (favorite_places.length === 0) {
        for (let favorite in unsynced_favorite_places) {
          responseFromDeleteFavorite = await FavoriteModel(
            tenant.toLowerCase()
          ).remove(
            {
              filter: unsynced_favorite_places[favorite],
            },
            next
          );
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
        const existingFavorite = await FavoriteModel(
          tenant.toLowerCase()
        ).findOne({
          firebase_user_id: favorite.firebase_user_id,
          place_id: favorite.place_id,
        });
        if (!existingFavorite) {
          responseFromCreateFavorite = await FavoriteModel(
            tenant.toLowerCase()
          ).register(missing_favorite_places[favorite], next);
          logObject("responseFromCreateFavorite", responseFromCreateFavorite);
        }
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
        ).remove(
          {
            filter,
          },
          next
        );
      }

      let synchronizedFavorites = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

      if (
        responseFromCreateFavorite.success === false &&
        responseFromDeleteFavorite.success === false
      ) {
        next(
          new HttpError(
            "Error Synchronizing favorites",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Response from Create Favorite: ${responseFromCreateFavorite.errors.message}
             + Response from Delete Favorite: ${responseFromDeleteFavorite.errors.message}`,
            }
          )
        );
      }

      return {
        success: true,
        message: "Favorites Synchronized",
        data: synchronizedFavorites,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = favorites;
