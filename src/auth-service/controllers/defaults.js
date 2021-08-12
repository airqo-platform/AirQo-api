const DefaultSchema = require("../models/Defaults");
const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("../utils/log");
const { getModelByTenant } = require("../utils/multitenancy");
const {
  tryCatchErrors,
  axiosError,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");
const defaultsUtil = require("../utils/defaults");

const generateFilter = require("../utils/generate-filter");

const DefaultModel = (tenant) => {
  return getModelByTenant(tenant, "default", DefaultSchema);
};

const defaults = {
  update: async (req, res, next) => {
    try {
      const { tenant, user, chartTitle } = req.query;

      if (!user && !chartTitle && !tenant) {
        missingQueryParams(req, res);
      }

      const responseFromFilter = generateFilter.defaults(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let requestBody = req.body;
        let responseFromUpdateDefault = await defaultsUtil.update(
          tenant,
          filter,
          requestBody
        );
        logObject("responseFromUpdateDefault", responseFromUpdateDefault);
        if (responseFromUpdateDefault.success == true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromUpdateDefault.message,
            default: responseFromUpdateDefault.data,
          });
        } else if (responseFromUpdateDefault.success == false) {
          if (responseFromUpdateDefault.error) {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateDefault.message,
              default: responseFromUpdateDefault.data,
              error: responseFromUpdateDefault.error,
            });
          } else {
            res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromUpdateDefault.message,
              default: responseFromUpdateDefault.data,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      tryCatchErrors(res, error, "defaults controller");
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all users by query params provided");
      const { tenant } = req.query;
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      if (!tenant) {
        return missingQueryParams(req, res);
      }
      let responseFromFilter = generateFilter.defaults(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let responseFromListDefaults = await defaultsUtil.list(
          tenant,
          filter,
          limit,
          skip
        );
        logObject("responseFromListDefaults", responseFromListDefaults);
        if (responseFromListDefaults.success == true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromListDefaults.message,
            defaults: responseFromListDefaults.data,
          });
        } else if (responseFromListDefaults.success == false) {
          if (responseFromListDefaults.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListDefaults.message,
              error: responseFromListDefaults.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListDefaults.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      tryCatchErrors(res, error, "join controller");
    }
  },

  unauthorized: (req, res) => {
    return res.status(HTTPStatus.UNAUTHORIZED).json({
      success: false,
      message: "You are not authenticated.",
      error: "Unauthorized",
    });
  },

  forbidden: (req, res) => {
    return res.status(HTTPStatus.FORBIDDEN).json({
      success: false,
      message: "You don't have enough rights to perform this action",
      error: "Permission Denied",
    });
  },
};

module.exports = defaults;
