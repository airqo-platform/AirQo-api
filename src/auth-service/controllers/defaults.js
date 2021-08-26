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

      const { tenant } = req.query;

      const responseFromFilter = generateFilter.defaults(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let request = req.body;
        let responseFromUpdateDefault = await defaultsUtil.update(
          tenant,
          filter,
          request
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
          let errors = responseFromUpdateDefault.errors
            ? responseFromUpdateDefault.errors
            : "";
          let status = responseFromUpdateDefault.status
            ? responseFromUpdateDefault.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            message: responseFromUpdateDefault.message,
            default: responseFromUpdateDefault.data,
            errors,
          });
        }
      }

      if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        let status = responseFromFilter.status
          ? responseFromFilter.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromFilter.message,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "defaults controller");
    }
  },

  create: async (req, res) => {
    try {
      let { body, query } = req;
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
      request["body"] = body;
      request["query"] = query;

      let responseFromCreateDefault = await defaultsUtil.create(request);
      logObject("responseFromCreateDefault", responseFromCreateDefault);
      if (responseFromCreateDefault.success === true) {
        let status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateDefault.message,
          default: responseFromCreateDefault.data,
        });
      }

      if (responseFromCreateDefault.success === false) {
        let errors = responseFromCreateDefault.errors
          ? responseFromCreateDefault.errors
          : "";
        let status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateDefault.message,
          default: responseFromCreateDefault.data,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "defaults controller");
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
        if (responseFromListDefaults.success === true) {
          let status = responseFromListDefaults.status
            ? responseFromListDefaults.status
            : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            message: responseFromListDefaults.message,
            defaults: responseFromListDefaults.data,
          });
        }

        if (responseFromListDefaults.success === false) {
          let errors = responseFromListDefaults.errors
            ? responseFromListDefaults.errors
            : "";

          let status = responseFromListDefaults.status
            ? responseFromListDefaults.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;

          return res.status(status).json({
            success: false,
            message: responseFromListDefaults.message,
            errors,
          });
        }
      }

      if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        let status = responseFromFilter.status
          ? responseFromFilter.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromFilter.message,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "join controller");
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
        let errors = responseFromDeleteDefault.errors
          ? responseFromDeleteDefault.errors
          : "";

        let status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromDeleteDefault.message,
          default: responseFromDeleteDefault.data,
          errors,
        });
      }
    } catch (errors) {
      tryCatchErrors(res, errors, "defaults controller");
    }
  },
};

module.exports = defaults;
