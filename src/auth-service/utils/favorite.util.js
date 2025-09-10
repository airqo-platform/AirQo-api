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
      const responseFromCreateFavorite = await FavoriteModel(
        tenant.toLowerCase()
      ).upsert(body, next);

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

      let filter = {
        firebase_user_id: firebase_user_id,
      };

      // Get current favorites for the user
      const listResponse = await FavoriteModel(tenant.toLowerCase()).list({
        filter,
      });
      if (!listResponse.success) {
        return {
          success: false,
          message: "Failed to retrieve current favorites",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: listResponse.errors || {
            message: "Failed to retrieve favorites",
          },
        };
      }

      let unsynced_favorite_places = listResponse.data || [];

      // Remove _id for comparison
      unsynced_favorite_places = unsynced_favorite_places.map(
        ({ _id, ...rest }) => rest
      );

      // Handle empty favorite_places - delete all existing favorites
      if (favorite_places.length === 0) {
        let deletionSummary = {
          deleted: 0,
          failed: 0,
          errors: [],
        };

        // Delete all existing favorites sequentially to avoid overwhelming the DB
        for (const favorite of unsynced_favorite_places) {
          try {
            const deleteResponse = await FavoriteModel(
              tenant.toLowerCase()
            ).remove({
              filter: {
                firebase_user_id: favorite.firebase_user_id,
                place_id: favorite.place_id,
              },
            });

            if (deleteResponse.success) {
              deletionSummary.deleted++;
            } else {
              deletionSummary.failed++;
              deletionSummary.errors.push(
                `Failed to delete favorite: ${favorite.place_id}`
              );
              logger.error(
                `Failed to delete favorite: ${JSON.stringify(favorite)}`
              );
            }
          } catch (error) {
            deletionSummary.failed++;
            deletionSummary.errors.push(
              `Error deleting favorite: ${favorite.place_id} - ${error.message}`
            );
            logger.error(
              `Error deleting favorite: ${JSON.stringify(favorite)}, Error: ${
                error.message
              }`
            );
          }
        }

        // Return success even if some deletions failed, but include summary
        return {
          success: true,
          message: "Favorite places removal completed",
          data: [],
          status: httpStatus.OK,
          summary: deletionSummary,
        };
      }

      // Find missing favorites that need to be created
      const missing_favorite_places = favorite_places.filter((item) => {
        const found = unsynced_favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            favorite.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      // Create missing favorites with proper error handling
      let createSummary = {
        created: 0,
        failed: 0,
        errors: [],
      };

      for (const favorite of missing_favorite_places) {
        try {
          // Check if favorite already exists (race condition protection)
          const existingFavorite = await FavoriteModel(
            tenant.toLowerCase()
          ).findOne({
            firebase_user_id: favorite.firebase_user_id,
            place_id: favorite.place_id,
          });

          if (!existingFavorite) {
            const createResponse = await FavoriteModel(
              tenant.toLowerCase()
            ).register(favorite);

            if (createResponse.success) {
              createSummary.created++;
            } else {
              createSummary.failed++;
              createSummary.errors.push(
                `Failed to create favorite: ${favorite.place_id}`
              );
              logger.error(
                `Failed to create favorite: ${JSON.stringify(favorite)}`
              );
            }
          } else {
            // Favorite already exists, count as success but don't increment created
            logger.info(
              `Favorite already exists for place_id: ${favorite.place_id}`
            );
          }
        } catch (error) {
          // Handle duplicate key error gracefully
          if (error.code === 11000) {
            logger.info(
              `Favorite already exists for place_id: ${favorite.place_id}, firebase_user_id: ${favorite.firebase_user_id}`
            );
            // Don't count this as a failure since the favorite exists
          } else {
            createSummary.failed++;
            createSummary.errors.push(
              `Error creating favorite: ${favorite.place_id} - ${error.message}`
            );
            logger.error(
              `Error creating favorite: ${JSON.stringify(favorite)}, Error: ${
                error.message
              }`
            );
          }
        }
      }

      // Find extra favorites that need to be deleted
      const extra_favorite_places = unsynced_favorite_places.filter((item) => {
        const found = favorite_places.some((favorite) => {
          return (
            favorite.place_id === item.place_id &&
            item.firebase_user_id === authenticatedUserId
          );
        });
        return !found;
      });

      // Delete extra favorites using authenticated user ID
      let deletionSummary = {
        deleted: 0,
        failed: 0,
        errors: [],
      };

      for (const favorite of extra_favorite_places) {
        try {
          const deleteResponse = await favorites.deleteFavoriteForUser(
            lowerTenant,
            authenticatedUserId,
            favorite.place_id
          );

          if (deleteResponse.success) {
            deletionSummary.deleted++;
          } else {
            deletionSummary.failed++;
            deletionSummary.errors.push(
              `Failed to delete extra favorite: ${favorite.place_id}`
            );
            logger.error(
              `Failed to delete extra favorite for user ${authenticatedUserId}: ${favorite.place_id}`
            );
          }
        } catch (error) {
          deletionSummary.failed++;
          deletionSummary.errors.push(
            `Error deleting extra favorite: ${favorite.place_id} - ${error.message}`
          );
          logger.error(
            `Error deleting extra favorite for user ${authenticatedUserId}: ${favorite.place_id}, Error: ${error.message}`
          );
        }
      }

      // Get final synchronized favorites
      const finalListResponse = await FavoriteModel(lowerTenant).list({
        filter,
      });
      let synchronizedFavorites = finalListResponse.success
        ? finalListResponse.data
        : [];

      // Determine overall success
      const hasFailures =
        createSummary.failed > 0 || deletionSummary.failed > 0;

      if (hasFailures) {
        logger.warn(
          `Sync completed with issues - Failed creates: ${createSummary.failed}, Failed deletes: ${deletionSummary.failed}`
        );
      }

      return {
        success: true, // Return success even with some failures for partial sync
        message: hasFailures
          ? "Favorites synchronized with some issues"
          : "Favorites synchronized successfully",
        data: synchronizedFavorites,
        status: httpStatus.OK,
        summary: {
          created: createSummary.created,
          deleted: deletionSummary.deleted,
          failed: createSummary.failed + deletionSummary.failed,
          errors: [...createSummary.errors, ...deletionSummary.errors],
        },
      };
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error in syncFavorites: ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

module.exports = favorites;
