const DefaultsModel = require("@models/Defaults");
const UserModel = require("@models/User");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const httpStatus = require("http-status");
const constants = require("../config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- defaults-util`);
const { HttpError } = require("@utils/errors");

const defaults = {
  list: async (request) => {
    try {
      const {
        query: { tenant },
      } = request;
      const filterResponse = generateFilter.defaults(request);
      if (!filterResponse.success) {
        return filterResponse;
      }
      const { limit, skip } = request.query;
      logObject("limit", limit);
      logObject("skip", skip);
      return await DefaultsModel(tenant).list({
        filter: filterResponse.data,
        limit,
        skip,
      });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
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

      const responseFromRegisterDefault = await DefaultsModel(tenant).register(
        body
      );
      logObject("responseFromRegisterDefault", responseFromRegisterDefault);

      return responseFromRegisterDefault;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  update: async (request) => {
    try {
      const {
        query: { tenant },
        body,
      } = request;

      const filterResponse = generateFilter.defaults(request);
      logObject("filterResponse", filterResponse);

      if (!filterResponse.success) {
        return filterResponse;
      }

      const { data: filter } = filterResponse;
      const update = body;

      const modifyResponse = await DefaultsModel(tenant).modify({
        filter,
        update,
      });
      logObject("modifyResponse", modifyResponse);

      return modifyResponse;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  delete: async (request) => {
    try {
      const responseFromFilter = generateFilter.defaults(request);

      if (!responseFromFilter.success) {
        return responseFromFilter;
      }

      const filter = responseFromFilter.data;
      const { tenant } = request.query;
      const responseFromRemoveDefault = await DefaultsModel(tenant).remove({
        filter,
      });
      return responseFromRemoveDefault;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
};

module.exports = defaults;
