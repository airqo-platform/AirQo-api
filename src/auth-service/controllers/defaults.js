const HTTPStatus = require("http-status");
const { logElement, logText, logObject } = require("../utils/log");
const { tryCatchErrors, missingQueryParams } = require("../utils/errors");
const defaultsUtil = require("../utils/defaults");
const generateFilter = require("../utils/generate-filter");
const { validationResult } = require("express-validator");
const manipulateArraysUtil = require("../utils/manipulate-arrays");
const { badRequest } = require("../utils/errors");

const defaults = {
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }

      const { tenant, id, user_id, user } = req.query;

      const responseFromFilter = generateFilter.defaults(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let requestBody = req.body;
        requestBody["user"] = id || user || user_id;
        let responseFromUpdateDefault = await defaultsUtil.update(
          tenant,
          filter,
          requestBody
        );
        logObject("responseFromUpdateDefault", responseFromUpdateDefault);
        if (responseFromUpdateDefault.success === true) {
          let status = responseFromUpdateDefault.status
            ? responseFromUpdateDefault.status
            : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            message: responseFromUpdateDefault.message,
            default: responseFromUpdateDefault.data,
          });
        }

        if (responseFromUpdateDefault.success === false) {
          let error = responseFromUpdateDefault.error
            ? responseFromUpdateDefault.error
            : "";
          let status = responseFromUpdateDefault.status
            ? responseFromUpdateDefault.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            message: responseFromUpdateDefault.message,
            default: responseFromUpdateDefault.data,
            error,
          });
        }
      }

      if (responseFromFilter.success === false) {
        let error = responseFromFilter.error ? responseFromFilter.error : "";
        let status = responseFromFilter.status
          ? responseFromFilter.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromFilter.message,
          error,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error, "defaults controller");
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all defaults by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);

      let request = {};
      request["body"] = req.body;
      request["query"] = req.query;
      let responseFromFilter = generateFilter.defaults(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let responseFromListDefaults = await defaultsUtil.list(
          tenant,
          filter,
          limit,
          skip
        );
        // logObject("responseFromListDefaults", responseFromListDefaults);
        if (responseFromListDefaults.success === true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromListDefaults.message,
            defaults: responseFromListDefaults.data,
          });
        }

        if (responseFromListDefaults.success === false) {
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
      }

      if (responseFromFilter.success === false) {
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

  delete: async (req, res) => {
    try {
      logText("deleting default..........");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = {};
      request["body"] = req.body;
      request["query"] = req.query;
      let responseFromDeleteDefault = await defaultsUtil.delete(request);
      logObject("responseFromDeleteDefault", responseFromDeleteDefault);
      if (responseFromDeleteDefault.success === true) {
        let status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeleteDefault.message,
          default: responseFromDeleteDefault.data,
        });
      }

      if (responseFromDeleteDefault.success === false) {
        let error = responseFromDeleteDefault.error
          ? responseFromDeleteDefault.error
          : "";

        let status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromDeleteDefault.message,
          default: responseFromDeleteDefault.data,
          error,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error, "defaults controller");
    }
  },
};

module.exports = defaults;
