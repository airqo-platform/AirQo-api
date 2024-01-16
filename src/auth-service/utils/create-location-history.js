const LocationHistoryModel = require("@models/LocationHistory");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const constants = require("@config/constants");
const log4js = require("log4js");
const { log } = require("firebase-functions/logger");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-location-history-util`
);
const { HttpError } = require("@utils/errors");

const locationHistories = {
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
  /******* location Histories *******************************************/
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.location_histories(request, next);
      const responseFromListLocationHistories = await LocationHistoryModel(
        tenant.toLowerCase()
      ).list({ filter }, next);
      return responseFromListLocationHistories;
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
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.location_histories(request, next);
      const responseFromDeleteLocationHistories = await LocationHistoryModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromDeleteLocationHistories;
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
      const filter = generateFilter.location_histories(request, next);
      const responseFromUpdateLocationHistories = await LocationHistoryModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateLocationHistories;
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
      const responseFromCreateLocationHistory = await LocationHistoryModel(
        tenant.toLowerCase()
      ).register(body, next);
      return responseFromCreateLocationHistory;
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
  syncLocationHistories: async (request, next) => {
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
        await LocationHistoryModel(tenant.toLowerCase()).list({ filter }, next)
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
        const updateFilter = {
          firebase_user_id: firebase_user_id,
          place_id: missing_location_histories[location_history].place_id,
        };
        const update = {
          ...missing_location_histories[location_history],
        };
        responseFromCreateLocationHistories = await LocationHistoryModel(
          tenant.toLowerCase()
        )
          .findOneAndUpdate(updateFilter, update, {
            new: true,
            upsert: true,
          })
          .exec();
      }

      let synchronizedLocationHistories = (
        await LocationHistoryModel(tenant.toLowerCase()).list({ filter }, next)
      ).data;

      if (responseFromCreateLocationHistories.success === false) {
        next(
          new HttpError(
            "Error Synchronizing Location Histories",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Response from Create Location History: ${responseFromCreateLocationHistories.errors.message}`,
            }
          )
        );
      }

      return {
        success: true,
        message: "Location Histories Synchronized",
        data: synchronizedLocationHistories,
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

module.exports = locationHistories;
