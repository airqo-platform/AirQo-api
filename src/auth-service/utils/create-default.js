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
  list: async (request, next) => {
    try {
      const {
        query: { tenant },
      } = request;
      const filter = generateFilter.defaults(request, next);
      const { limit, skip } = request.query;
      return await DefaultsModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
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
      const { body, query } = request;
      const { tenant } = query;
      const user_id = body.user;
      const user = await UserModel(tenant).findById(user_id).lean();
      if (isEmpty(user_id) || isEmpty(user)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "The provided User does not exist",
            value: user_id,
          })
        );
      }

      const responseFromRegisterDefault = await DefaultsModel(tenant).register(
        body,
        next
      );
      return responseFromRegisterDefault;
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
      const {
        query: { tenant },
        body,
      } = request;

      const filter = generateFilter.defaults(request, next);
      const update = body;

      const modifyResponse = await DefaultsModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );

      return modifyResponse;
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
      const filter = generateFilter.defaults(request, next);
      const { tenant } = request.query;
      const responseFromRemoveDefault = await DefaultsModel(tenant).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveDefault;
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

module.exports = defaults;
