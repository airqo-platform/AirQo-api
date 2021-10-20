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
        let status = responseFromListDefault.status
          ? responseFromListDefault.status
          : "";
        return {
          success: true,
          message: responseFromListDefault.message,
          data: responseFromListDefault.data,
          status,
        };
      }

      if (responseFromListDefault.success === false) {
        let errors = responseFromListDefault.errors
          ? responseFromListDefault.errors
          : "";

        let status = responseFromListDefault.status
          ? responseFromListDefault.status
          : "";

        return {
          success: false,
          message: responseFromListDefault.message,
          errors,
          status,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "utils server errors",
        errors: e.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (request) => {
    try {
      let { body, query } = request;
      let { tenant } = query;

      logObject("the body", body);

      let responseFromRegisterDefault = await getModelByTenant(
        tenant.toLowerCase(),
        "default",
        DefaultsSchema
      ).register(body);
      logObject("responseFromRegisterDefault", responseFromRegisterDefault);

      if (responseFromRegisterDefault.success === true) {
        let status = responseFromRegisterDefault.status
          ? responseFromRegisterDefault.status
          : "";
        return {
          success: true,
          message: responseFromRegisterDefault.message,
          data: responseFromRegisterDefault.data,
          status,
        };
      }

      if (responseFromRegisterDefault.success === false) {
        let errors = responseFromRegisterDefault.errors
          ? responseFromRegisterDefault.errors
          : "";

        let status = responseFromRegisterDefault.status
          ? responseFromRegisterDefault.status
          : "";

        return {
          success: false,
          message: responseFromRegisterDefault.message,
          errors,
          status,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "defaults util server errors",
        errors: e.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
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
        let errors = responseFromModifyDefault.errors
          ? responseFromModifyDefault.errors
          : "";

        let status = responseFromModifyDefault.status
          ? responseFromModifyDefault.status
          : "";

        return {
          success: false,
          message: responseFromModifyDefault.message,
          errors,
          status,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "defaults util server errors",
        errors: e.message,
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

      if (responseFromRemoveDefault.success === true) {
        let status = responseFromRemoveDefault.status
          ? responseFromRemoveDefault.status
          : "";
        return {
          success: true,
          message: responseFromRemoveDefault.message,
          data: responseFromRemoveDefault.data,
          status,
        };
      }
      if (responseFromRemoveDefault.success === false) {
        let errors = responseFromRemoveDefault.errors
          ? responseFromRemoveDefault.errors
          : "";

        let status = responseFromRemoveDefault.status
          ? responseFromRemoveDefault.status
          : "";

        return {
          success: false,
          errors,
          message: responseFromRemoveDefault.message,
          status,
        };
      }
    }

    if (responseFromFilter.success === false) {
      let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
      return {
        success: false,
        message: responseFromFilter.message,
        errors,
      };
    }
  },
};

module.exports = defaults;
