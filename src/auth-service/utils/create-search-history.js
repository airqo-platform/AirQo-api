const SearchHistoryModel = require("@models/searchHistory");
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

const searchHistories = {
  sample: async (request) => {
    try {
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /******* search Histories *******************************************/
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.search_histories(request);
      if (filter.success === false) {
        return filter;
      }

      const responseFromListSearchHistoriesPromise = SearchHistoryModel(
        tenant.toLowerCase()
      ).list({ filter });
      const responseFromListSearchHistories =
        await responseFromListSearchHistoriesPromise;
      return responseFromListSearchHistories;
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
      const filter = generateFilter.search_histories(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromDeleteSearchHistories = await SearchHistoryModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      return responseFromDeleteSearchHistories;
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
      const filter = generateFilter.search_histories(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromUpdateSearchHistories = await SearchHistoryModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateSearchHistories;
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

      const responseFromCreateSearchHistory = await SearchHistoryModel(
        tenant.toLowerCase()
      ).register(body);
      return responseFromCreateSearchHistory;
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

  syncSearchHistories: async (request) => {
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
        responseFromCreateSearchHistories = await SearchHistoryModel(
          tenant.toLowerCase()
        ).register(missing_search_histories[search_history]);
      }

      let synchronizedSearchHistories = (
        await SearchHistoryModel(tenant.toLowerCase()).list({ filter })
      ).data;

      if (responseFromCreateSearchHistories.success === false) {
        return {
          success: false,
          message: "Error Synchronizing Search Histories",
          errors: {
            message: `Response from Create Search History: ${responseFromCreateSearchHistories.errors.message}`,
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      return {
        success: true,
        message: "Search Histories Synchronized",
        data: synchronizedSearchHistories,
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

module.exports = searchHistories;
