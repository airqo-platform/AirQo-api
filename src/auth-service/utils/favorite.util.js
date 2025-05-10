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
      ).modify({ filter, update }, next);

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

      let filter = {
        firebase_user_id: firebase_user_id,
      };

      // Get current favorites for the user
      let unsynced_favorite_places = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

      // Remove _id for comparison
      unsynced_favorite_places = unsynced_favorite_places.map(
        ({ _id, ...rest }) => rest
      );

      // Handle empty favorite_places - delete all existing favorites
      if (favorite_places.length === 0) {
        // Parallel deletion of all favorites
        const deletionResults = await Promise.allSettled(
          unsynced_favorite_places.map((favorite) =>
            FavoriteModel(tenant.toLowerCase()).remove(
              { filter: favorite },
              next
            )
          )
        );

        // Log any deletion failures
        deletionResults.forEach((result, index) => {
          if (result.status === "rejected") {
            logger.error(
              `Failed to delete favorite: ${JSON.stringify(
                unsynced_favorite_places[index]
              )}, Error: ${result.reason}`
            );
          }
        });

        return {
          success: true,
          message: "All favorite places removed",
          data: [],
          status: httpStatus.OK,
        };
      }

      // Find missing favorites
      const missing_favorite_places = favorite_places.filter((item) => {
        const found = unsynced_favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            favorite.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      // Create missing favorites in parallel with proper error handling
      let createResults = [];
      if (missing_favorite_places.length > 0) {
        createResults = await Promise.allSettled(
          missing_favorite_places.map(async (favorite) => {
            try {
              // Check if favorite already exists (race condition protection)
              const existingFavorite = await FavoriteModel(
                tenant.toLowerCase()
              ).findOne({
                firebase_user_id: favorite.firebase_user_id,
                place_id: favorite.place_id,
              });

              if (!existingFavorite) {
                return await FavoriteModel(tenant.toLowerCase()).register(
                  favorite,
                  next
                );
              }

              return {
                success: true,
                message: "Favorite already exists",
                data: existingFavorite,
              };
            } catch (error) {
              // Handle duplicate key error
              if (error.code === 11000) {
                logger.info(
                  `Favorite already exists for place_id: ${favorite.place_id}, firebase_user_id: ${favorite.firebase_user_id}`
                );
                return {
                  success: true,
                  message: "Favorite already exists (duplicate key)",
                  data: favorite,
                };
              }
              throw error;
            }
          })
        );

        // Log results
        createResults.forEach((result, index) => {
          if (result.status === "rejected") {
            logger.error(
              `Failed to create favorite: ${JSON.stringify(
                missing_favorite_places[index]
              )}, Error: ${result.reason}`
            );
          } else if (result.value?.success) {
            logger.info(
              `Successfully processed favorite: ${JSON.stringify(
                missing_favorite_places[index]
              )}`
            );
          }
        });
      }

      // Find extra favorites to delete
      const extra_favorite_places = unsynced_favorite_places.filter((item) => {
        const found = favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            favorite.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      // Delete extra favorites in parallel
      let deleteResults = [];
      if (extra_favorite_places.length > 0) {
        deleteResults = await Promise.allSettled(
          extra_favorite_places.map((favorite) =>
            FavoriteModel(tenant.toLowerCase()).remove(
              {
                filter: {
                  firebase_user_id: favorite.firebase_user_id,
                  place_id: favorite.place_id,
                },
              },
              next
            )
          )
        );

        // Log deletion results
        deleteResults.forEach((result, index) => {
          if (result.status === "rejected") {
            logger.error(
              `Failed to delete extra favorite: ${JSON.stringify(
                extra_favorite_places[index]
              )}, Error: ${result.reason}`
            );
          }
        });
      }

      // Get final synchronized favorites
      let synchronizedFavorites = (
        await FavoriteModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

      // Check for any failed operations
      const failedCreates = createResults.filter(
        (r) => r.status === "rejected"
      ).length;
      const failedDeletes = deleteResults.filter(
        (r) => r.status === "rejected"
      ).length;

      if (failedCreates > 0 || failedDeletes > 0) {
        logger.warn(
          `Sync completed with issues - Failed creates: ${failedCreates}, Failed deletes: ${failedDeletes}`
        );
      }

      return {
        success: true,
        message: "Favorites Synchronized",
        data: synchronizedFavorites,
        status: httpStatus.OK,
        summary: {
          created: createResults.filter(
            (r) => r.status === "fulfilled" && r.value?.success
          ).length,
          deleted: deleteResults.filter(
            (r) => r.status === "fulfilled" && r.value?.success
          ).length,
          failed: failedCreates + failedDeletes,
        },
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
