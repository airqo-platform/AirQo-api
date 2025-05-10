const FavoriteModel = require("@models/Favorite");
const httpStatus = require("http-status");
const { generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const { log } = require("firebase-functions/logger");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-favorite-util`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

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
      const { place_id, firebase_user_id } = body;

      // First check if the favorite already exists
      const existingFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).findOne({
        place_id,
        firebase_user_id,
      });

      if (existingFavorite) {
        // If it exists, update it instead of creating a new one
        const updateResponse = await FavoriteModel(tenant.toLowerCase()).modify(
          {
            filter: { _id: existingFavorite._id },
            update: body,
          },
          next
        );

        return {
          ...updateResponse,
          message: "Favorite already exists, updated instead",
        };
      }

      // If it doesn't exist, create it
      const responseFromCreateFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).register(body, next);

      return responseFromCreateFavorite;
    } catch (error) {
      // Handle duplicate key error specifically
      if (error.code === 11000) {
        const keyPattern = error.keyPattern;
        const keyValue = error.keyValue;

        // logger.warn(`Duplicate favorite detected: ${JSON.stringify(keyValue)}`);

        return {
          success: false,
          message: "This place is already in your favorites",
          status: httpStatus.CONFLICT,
          errors: {
            duplicate: true,
            place_id: keyValue.place_id,
            firebase_user_id: keyValue.firebase_user_id,
          },
        };
      }

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

      let responseFromUpsertFavorite = {
        success: true,
        data: [],
        message: "No favorites to sync",
      };
      let responseFromDeleteFavorite = {
        success: true,
        data: [],
        message: "No extra favorite places",
      };

      let filter = {
        firebase_user_id: firebase_user_id,
      };

      // Get current favorites for the user
      let unsynced_favorite_places = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

      // Remove _id for comparison
      unsynced_favorite_places = unsynced_favorite_places.map((item) => {
        delete item._id;
        return item;
      });

      // Handle empty favorite_places - delete all existing favorites
      if (favorite_places.length === 0) {
        for (let favorite of unsynced_favorite_places) {
          await FavoriteModel(tenant.toLowerCase()).remove(
            { filter: favorite },
            next
          );
        }

        return {
          success: true,
          message: "All favorite places removed",
          data: [],
          status: httpStatus.OK,
        };
      }

      // Upsert all favorites from the request
      const upsertPromises = favorite_places.map(async (favorite) => {
        try {
          const response = await FavoriteModel(tenant.toLowerCase()).upsert(
            favorite,
            next
          );
          return response;
        } catch (error) {
          logger.error(`Error upserting favorite: ${error.message}`);
          return { success: false, error: error.message };
        }
      });

      // Wait for all upserts to complete
      const upsertResults = await Promise.all(upsertPromises);

      // Check if any upserts failed
      const failedUpserts = upsertResults.filter((result) => !result.success);
      if (failedUpserts.length > 0) {
        logger.warn(
          `Some favorites failed to upsert: ${JSON.stringify(failedUpserts)}`
        );
      }

      // Find and delete extra favorites that aren't in the incoming list
      const extra_favorite_places = unsynced_favorite_places.filter((item) => {
        const found = favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            favorite.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      // Delete extra favorites
      if (extra_favorite_places.length > 0) {
        for (let favorite of extra_favorite_places) {
          let deleteFilter = {
            firebase_user_id: favorite.firebase_user_id,
            place_id: favorite.place_id,
          };
          await FavoriteModel(tenant.toLowerCase()).remove(
            { filter: deleteFilter },
            next
          );
        }
      }

      // Get final synchronized favorites
      let synchronizedFavorites = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

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
