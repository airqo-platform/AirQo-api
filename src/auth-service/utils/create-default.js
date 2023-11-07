const DefaultsModel = require("@models/Defaults");
const UserModel = require("@models/User");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const httpStatus = require("http-status");
const constants = require("../config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- defaults-util`);

const defaults = {
  list: async (tenant, filter, limit, skip) => {
    try {
      const responseFromListDefault = await DefaultsModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListDefault;
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

      const responseFromRegisterDefault = await DefaultsModel(tenant).register(
        body
      );
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
  update: async (tenant, filter, update) => {
    try {
      const responseFromModifyDefault = await DefaultsModel(tenant).modify({
        filter,
        update,
      });
      logObject("responseFromModifyDefault", responseFromModifyDefault);
      return responseFromModifyDefault;
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
      const responseFromFilter = generateFilter.defaults(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;
      const { tenant } = request.query;
      const responseFromRemoveDefault = await DefaultsModel(tenant).remove({
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

module.exports = defaults;
