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
        delete requestBody._id;
        delete requestBody.chartTitle;
        delete requestBody.user;
        let responseFromUpdateDefault = await requestUtil.update(
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
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "defaults controller server error",
        error: error.message,
      });
    }
  },

  list: async (req, res) => {
    try {
      const { tenant } = req.query;

      if (!tenant) {
        missingQueryParams(req, res);
      }
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let responseFromFilter = generateFilter.defaults(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        const responseFromListDefault = await DefaultModel(
          tenant.toLowerCase()
        ).list({
          filter: responseFromFilter.data,
          limit,
          skip,
        });
        logObject("responseFromListDefault", responseFromListDefault);
        if (responseFromListDefault.success == true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromListDefault.message,
            defaults: responseFromListDefault.data,
          });
        } else if (responseFromListDefault.success == false) {
          if (responseFromListDefault.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListDefault.message,
              error: responseFromListDefault.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromListDefault.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
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
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: e.message,
      });
    }
  },
};

module.exports = defaults;
