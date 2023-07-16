const HostModel = require("@models/Host");
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger("create-host-util");

const createHost = {
  create: async (request) => {
    try {
      const { body } = request;
      const { tenant } = request.query;
      logObject("body", body);
      const responseFromRegisterHost = await HostModel(tenant).register(body);
      logObject("responseFromRegisterHost", responseFromRegisterHost);
      return responseFromRegisterHost;
    } catch (error) {
      logElement(" the util server error,", error.message);
      logger.error(`Internal Server Error --  ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  update: async (request) => {
    try {
      const { query } = request;
      const { body } = request;
      const { tenant } = query;

      let update = body;
      const filter = generateFilter.hosts(request);
      if (filter.success && filter.success === fale) {
        return filter;
      }

      const responseFromModifyHost = await HostModel(tenant).modify({
        filter,
        update,
      });

      return responseFromModifyHost;
    } catch (error) {
      logElement("update Hosts util", error.message);
      logger.error(`Internal Server Error --  ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.hosts(request);
      if (filter.success && filter.success === false) {
        return filter;
      }
      const responseFromRemoveHost = await HostModel(tenant).remove({
        filter,
      });
      return responseFromRemoveHost;
    } catch (error) {
      logElement("delete Host util", error.message);
      logger.error(`Internal Server Error --  ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const { limit, skip } = query;

      logObject("limit", limit);
      logObject("skip", skip);

      const filter = generateFilter.hosts(request);
      logObject("filter", filter);
      if (filter.success && filter.success === false) {
        return filter;
      }

      const responseFromListHost = await HostModel(tenant).list({
        filter,
        limit,
        skip,
      });

      return responseFromListHost;
    } catch (error) {
      logElement("list Hosts util", error.message);
      logger.error(`Internal Server Error --  ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createHost;
