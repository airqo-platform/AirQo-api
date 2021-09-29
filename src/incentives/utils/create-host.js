const HostModel = require("../models/Host");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger("create-host-util");

const createHost = {
  create: async (request) => {
    try {
      let { body } = request;
      let { tenant } = request.query;
      logObject("body", body);

      let responseFromRegisterHost = await HostModel(tenant).register(body);

      logObject("responseFromRegisterHost", responseFromRegisterHost);

      if (responseFromRegisterHost.success === true) {
        const status = responseFromRegisterHost.status
          ? responseFromRegisterHost.status
          : "";
        return {
          success: true,
          message: responseFromRegisterHost.message,
          data: responseFromRegisterHost.data,
          status,
        };
      }

      if (responseFromRegisterHost.success === false) {
        const errors = responseFromRegisterHost.errors
          ? responseFromRegisterHost.errors
          : "";

        const status = responseFromRegisterHost.status
          ? responseFromRegisterHost.status
          : "";

        return {
          success: false,
          message: responseFromRegisterHost.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement(" the util server error,", err.message);
      return {
        success: false,
        message: "unable to create host",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: err.message },
      };
    }
  },
  update: async (request) => {
    try {
      let { query } = request;
      let { body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.hosts(request);

      let responseFromModifyHost = await HostModel(tenant).modify({
        filter,
        update,
      });

      if (responseFromModifyHost.success === true) {
        const status = responseFromModifyHost.status
          ? responseFromModifyHost.status
          : "";
        return {
          success: true,
          message: responseFromModifyHost.message,
          data: responseFromModifyHost.data,
          status,
        };
      }

      if (responseFromModifyHost.success === false) {
        const errors = responseFromModifyHost.errors
          ? responseFromModifyHost.errors
          : "";

        const status = responseFromModifyHost.status
          ? responseFromModifyHost.status
          : "";

        return {
          success: false,
          message: responseFromModifyHost.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("update Hosts util", err.message);
      return {
        success: false,
        message: "unable to update host",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.hosts(request);
      let responseFromRemoveHost = await HostModel(tenant).remove({
        filter,
      });

      if (responseFromRemoveHost.success === true) {
        const status = responseFromRemoveHost.status
          ? responseFromRemoveHost.status
          : "";
        return {
          success: true,
          message: responseFromRemoveHost.message,
          data: responseFromRemoveHost.data,
          status,
        };
      }

      if (responseFromRemoveHost.success === false) {
        const errors = responseFromRemoveHost.errors
          ? responseFromRemoveHost.errors
          : "";

        const status = responseFromRemoveHost.status
          ? responseFromRemoveHost.status
          : "";

        return {
          success: false,
          message: responseFromRemoveHost.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("delete Host util", err.message);
      return {
        success: false,
        message: "unable to delete host",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;
      let filter = generateFilter.hosts(request);
      logObject("filter", filter);

      let responseFromListHost = await HostModel(tenant).list({
        filter,
        limit,
        skip,
      });

      logObject("responseFromListHost", responseFromListHost);
      if (responseFromListHost.success === false) {
        const errors = responseFromListHost.errors
          ? responseFromListHost.errors
          : "";

        const status = responseFromListHost.status
          ? responseFromListHost.status
          : "";
        return {
          success: false,
          message: responseFromListHost.message,
          errors,
          status,
        };
      }

      if (responseFromListHost.success === true) {
        const status = responseFromListHost.status
          ? responseFromListHost.status
          : "";
        const data = responseFromListHost.data;
        return {
          success: true,
          message: responseFromListHost.message,
          data,
          status,
        };
      }
    } catch (err) {
      logElement("list Hosts util", err.message);
      return {
        success: false,
        message: "unable to list host",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createHost;
