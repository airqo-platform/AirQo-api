const SearchHistoryModel = require("@models/SearchHistory");
const httpStatus = require("http-status");
const { logObject, logElement, logText } = require("@utils/log");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const { log } = require("firebase-functions/logger");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-search-history-util`
);
const { HttpError } = require("@utils/errors");

const searchHistories = {
  sample: async (request, next) => {
    try {
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  /******* search Histories *******************************************/
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.search_histories(request, next);
      const responseFromListSearchHistories = await SearchHistoryModel(
        tenant.toLowerCase()
      ).list({ filter });
      return responseFromListSearchHistories;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      const filter = generateFilter.search_histories(request, next);

      const responseFromDeleteSearchHistories = await SearchHistoryModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      return responseFromDeleteSearchHistories;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      const filter = generateFilter.search_histories(request, next);
      const responseFromUpdateSearchHistories = await SearchHistoryModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateSearchHistories;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      const responseFromCreateSearchHistory = await SearchHistoryModel(
        tenant.toLowerCase()
      ).register(body);
      return responseFromCreateSearchHistory;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  syncSearchHistories: async (request, next) => {
    try {
      const { query, body, params } = request;
      const { tenant } = query;
      const { search_histories } = body;
      const { firebase_user_id } = params;

      let responseFromCreateSearchHistories;
      let filter = {
        firebase_user_id: firebase_user_id,
      };

      let unsynced_search_histories = (
        await SearchHistoryModel(tenant.toLowerCase()).list({ filter })
      ).data;

      unsynced_search_histories = unsynced_search_histories.map((item) => {
        delete item._id;
        return item;
      });

      const missing_search_histories = search_histories.filter((item) => {
        const found = unsynced_search_histories.some((search_history) => {
          return (
            search_history.place_id === item.place_id &&
            search_history.firebase_user_id === item.firebase_user_id
          );
        });
        return !found;
      });

      if (missing_search_histories.length === 0) {
        responseFromCreateSearchHistories = {
          success: true,
          message: "No missing Search History ",
          data: [],
        };
      }

      for (let search_history in missing_search_histories) {
        const updateFilter = {
          firebase_user_id: firebase_user_id,
          place_id: missing_search_histories[search_history].place_id,
        };
        const update = {
          ...missing_search_histories[search_history],
        };
        responseFromCreateSearchHistories = await SearchHistoryModel(
          tenant.toLowerCase()
        )
          .findOneAndUpdate(updateFilter, update, {
            new: true,
            upsert: true,
          })
          .exec();
      }

      let synchronizedSearchHistories = (
        await SearchHistoryModel(tenant.toLowerCase()).list({ filter })
      ).data;

      if (responseFromCreateSearchHistories.success === false) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Response from Create Search History: ${responseFromCreateSearchHistories.errors.message}`,
            }
          )
        );
      }

      return {
        success: true,
        message: "Search Histories Synchronized",
        data: synchronizedSearchHistories,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

module.exports = searchHistories;
