const PreferenceModel = require("@models/Preference");
const UserModel = require("@models/User");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- preferences-util`);

const preferences = {
  list: async (request) => {
    try {
      const {
        query: { tenant },
      } = request;
      const filterResponse = generateFilter.preferences(request);
      if (!filterResponse.success) {
        return filterResponse;
      }
      const { limit, skip } = request.query;
      logObject("limit", limit);
      logObject("skip", skip);
      return await PreferenceModel(tenant).list({
        filter: filterResponse,
        limit,
        skip,
      });
    } catch (e) {
      logger.error(`Internal Server Error -- ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      logObject("the body", body);
      const user_id = body.user;
      const user = await UserModel(tenant).findById(user_id).lean();
      if (isEmpty(user_id) || isEmpty(user)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: "The provided User does not exist",
            value: user_id,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromRegisterDefault = await PreferenceModel(
        tenant
      ).register(body);
      logObject("responseFromRegisterDefault", responseFromRegisterDefault);

      return responseFromRegisterDefault;
    } catch (e) {
      logger.error(`Internal Server Error -- ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      const filterResponse = generateFilter.preferences(request);
      logObject("filterResponse", filterResponse);

      if (!filterResponse.success) {
        return filterResponse;
      }

      const filter = filterResponse;
      const update = body;

      const modifyResponse = await PreferenceModel(tenant).modify({
        filter,
        update,
      });
      logObject("modifyResponse", modifyResponse);

      return modifyResponse;
    } catch (e) {
      logger.error(`Internal Server Error -- ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  upsert: async (request) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      const filterResponse = generateFilter.preferences(request);
      logObject("filterResponse", filterResponse);

      if (!filterResponse.success) {
        return filterResponse;
      }

      const filter = filterResponse;
      const update = body;
      const options = { upsert: true, new: true };

      const modifyResponse = await PreferenceModel(tenant).findOneAndUpdate(
        filter,
        update,
        options
      );
      logObject("modifyResponse", modifyResponse);

      if (!isEmpty(modifyResponse)) {
        return {
          success: true,
          message: "successfully created or updated a preference",
          data: modifyResponse,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "unable to create or update a preference",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "unable to create or update a preference" },
        };
      }
    } catch (e) {
      logger.error(`Internal Server Error -- ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      const responseFromFilter = generateFilter.preferences(request);

      if (!responseFromFilter.success) {
        return responseFromFilter;
      }

      const filter = responseFromFilter;
      const { tenant } = request.query;
      const responseFromRemoveDefault = await PreferenceModel(tenant).remove({
        filter,
      });
      return responseFromRemoveDefault;
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = preferences;
