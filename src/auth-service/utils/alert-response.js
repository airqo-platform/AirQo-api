const AlertResponseModel = require("@models/AlertResponse");
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- alert-response-util`
);

const alertResponse = {
  create: async (request, next) => {
    try {
      const { body, query, user } = request;
      const { tenant } = query;
      const { _id } = user;

      const alertResponseData = {
        ...body,
        userId: _id,
      };

      return await AlertResponseModel(tenant).register(alertResponseData);
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
  list: async (request, next) => {
    try {
      const { query, user } = request;
      const { tenant } = query;
      const { _id } = user;

      const filter = { userId: _id };
      const { limit, skip } = query;

      return await AlertResponseModel(tenant).list({ filter, limit, skip });
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
  getStats: async (request, next) => {
    // Implementation for getting user's alert response statistics
  },
};

module.exports = alertResponse;
