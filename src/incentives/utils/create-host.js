const HostModel = require("@models/Host");
const constants = require("@config/constants");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-host-util`);
const { HttpError } = require("@utils/errors");

const createHost = {
  create: async (request, next) => {
    try {
      const { body } = request;
      const { tenant } = request.query;
      logObject("body", body);
      const responseFromRegisterHost = await HostModel(tenant).register(
        body,
        next
      );
      logObject("responseFromRegisterHost", responseFromRegisterHost);
      return responseFromRegisterHost;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  update: async (request, next) => {
    try {
      const { query } = request;
      const { body } = request;
      const { tenant } = query;

      let update = body;
      const filter = generateFilter.hosts(request, next);
      if (filter.success && filter.success === false) {
        return filter;
      }

      const responseFromModifyHost = await HostModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );

      return responseFromModifyHost;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  delete: async (request, next) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.hosts(request, next);
      if (filter.success && filter.success === false) {
        return filter;
      }
      const responseFromRemoveHost = await HostModel(tenant).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveHost;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const { limit, skip } = query;

      logObject("limit", limit);
      logObject("skip", skip);

      const filter = generateFilter.hosts(request, next);
      logObject("filter", filter);
      if (filter.success && filter.success === false) {
        return filter;
      }

      const responseFromListHost = await HostModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );

      return responseFromListHost;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = createHost;
