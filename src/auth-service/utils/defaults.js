const DefaultsSchema = require("../models/Defaults");
const { getModelByTenant } = require("./multitenancy");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const HTTPStatus = require("http-status");

const defaults = {
  list: async (tenant, filter, limit, skip) => {
    try {
      let responseFromListDefault = await getModelByTenant(
        tenant.toLowerCase(),
        "default",
        DefaultsSchema
      ).list({
        filter,
        limit,
        skip,
      });
      if (responseFromListDefault.success === true) {
        return {
          success: true,
          message: responseFromListDefault.message,
          data: responseFromListDefault.data,
        };
      }

      if (responseFromListDefault.success === false) {
        let error = responseFromListDefault.error
          ? responseFromListDefault.error
          : "";

        return {
          success: false,
          message: responseFromListDefault.message,
          error,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "utils server error",
        error: e.message,
      };
    }
  },
  update: async (tenant, filter, update) => {
    try {
      let responseFromModifyDefault = await getModelByTenant(
        tenant.toLowerCase(),
        "default",
        DefaultsSchema
      ).modify({
        filter,
        update,
      });
      logObject("responseFromModifyDefault", responseFromModifyDefault);
      if (responseFromModifyDefault.success === true) {
        let status = responseFromModifyDefault.status
          ? responseFromModifyDefault.status
          : "";
        return {
          success: true,
          message: responseFromModifyDefault.message,
          data: responseFromModifyDefault.data,
          status,
        };
      } else if (responseFromModifyDefault.success === false) {
        let error = responseFromModifyDefault.error
          ? responseFromModifyDefault.error
          : "";

        let status = responseFromModifyDefault.status
          ? responseFromModifyDefault.status
          : "";

        return {
          success: false,
          message: responseFromModifyDefault.message,
          error,
          status,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "defaults util server error",
        error: e.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  delete: async (request) => {
    const responseFromFilter = generateFilter.defaults(request);
    logObject("responseFromFilter", responseFromFilter);
    let filter = responseFromFilter.data;
    let { tenant } = request.query;
    if (responseFromFilter.success === true) {
      let responseFromRemoveDefault = await getModelByTenant(
        tenant.toLowerCase(),
        "default",
        DefaultsSchema
      ).remove({
        filter,
      });

      let status = responseFromRemoveDefault.status
        ? responseFromRemoveDefault.status
        : "";
      if (responseFromRemoveDefault.success === true) {
        return {
          success: true,
          message: responseFromRemoveDefault.message,
          data: responseFromRemoveDefault.data,
          status,
        };
      }
      if (responseFromRemoveDefault.success === false) {
        let error = responseFromRemoveDefault.error
          ? responseFromRemoveDefault.error
          : "";
        return {
          success: false,
          error,
          message: responseFromRemoveDefault.message,
          status,
        };
      }
    }

    if (responseFromFilter.success === false) {
      let error = responseFromFilter.error ? responseFromFilter.error : "";
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: responseFromFilter.message,
        error,
      });
    }
  },
};

module.exports = defaults;
