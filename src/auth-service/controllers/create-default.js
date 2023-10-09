const httpStatus = require("http-status");
const { logElement, logText, logObject } = require("@utils/log");
const createDefaultUtil = require("../utils/create-default");
const generateFilter = require("../utils/generate-filter");
const { validationResult } = require("express-validator");
const constants = require("../config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- defaults-controller`
);
const {
  badRequest,
  convertErrorArrayToObject,
  tryCatchErrors,
} = require("../utils/errors");

const defaults = {
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      const responseFromFilter = generateFilter.defaults(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let request = req.body;
        let responseFromUpdateDefault = await createDefaultUtil.update(
          tenant,
          filter,
          request
        );
        logObject("responseFromUpdateDefault", responseFromUpdateDefault);
        if (responseFromUpdateDefault.success === true) {
          let status = responseFromUpdateDefault.status
            ? responseFromUpdateDefault.status
            : httpStatus.OK;
          res.status(status).json({
            success: true,
            message: responseFromUpdateDefault.message,
            default: responseFromUpdateDefault.data,
          });
        } else if (responseFromUpdateDefault.success === false) {
          let errors = responseFromUpdateDefault.errors
            ? responseFromUpdateDefault.errors
            : "";
          let status = responseFromUpdateDefault.status
            ? responseFromUpdateDefault.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            message: responseFromUpdateDefault.message,
            default: responseFromUpdateDefault.data,
            errors,
          });
        }
      } else if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        let status = responseFromFilter.status
          ? responseFromFilter.status
          : httpStatus.INTERNAL_SERVER_ERROR;
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
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);

      let responseFromCreateDefault = await createDefaultUtil.create(request);
      logObject("responseFromCreateDefault", responseFromCreateDefault);
      if (responseFromCreateDefault.success === true) {
        let status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateDefault.message,
          default: responseFromCreateDefault.data,
        });
      } else if (responseFromCreateDefault.success === false) {
        let errors = responseFromCreateDefault.errors
          ? responseFromCreateDefault.errors
          : "";
        let status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateDefault.message,
          default: responseFromCreateDefault.data,
          errors,
        });
      }
    } catch (errors) {
      logger.error(`Internal Server Error -- ${JSON.stringify(errors)}`);
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
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);

      let request = {};
      request["body"] = req.body;
      request["query"] = req.query;
      let responseFromFilter = generateFilter.defaults(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let responseFromListDefaults = await createDefaultUtil.list(
          tenant,
          filter,
          limit,
          skip
        );
        if (responseFromListDefaults.success === true) {
          let status = responseFromListDefaults.status
            ? responseFromListDefaults.status
            : httpStatus.OK;
          res.status(status).json({
            success: true,
            message: responseFromListDefaults.message,
            defaults: responseFromListDefaults.data,
          });
        } else if (responseFromListDefaults.success === false) {
          let errors = responseFromListDefaults.errors
            ? responseFromListDefaults.errors
            : "";

          let status = responseFromListDefaults.status
            ? responseFromListDefaults.status
            : httpStatus.INTERNAL_SERVER_ERROR;

          return res.status(status).json({
            success: false,
            message: responseFromListDefaults.message,
            errors,
          });
        }
      } else if (responseFromFilter.success === false) {
        let errors = responseFromFilter.errors ? responseFromFilter.errors : "";
        let status = responseFromFilter.status
          ? responseFromFilter.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromFilter.message,
          errors,
        });
      }
    } catch (errors) {
      logObject("errors", errors);
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
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = {};
      request["body"] = req.body;
      request["query"] = req.query;
      let responseFromDeleteDefault = await createDefaultUtil.delete(request);
      logObject("responseFromDeleteDefault", responseFromDeleteDefault);
      if (responseFromDeleteDefault.success === true) {
        let status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeleteDefault.message,
          default: responseFromDeleteDefault.data,
        });
      } else if (responseFromDeleteDefault.success === false) {
        let errors = responseFromDeleteDefault.errors
          ? responseFromDeleteDefault.errors
          : "";

        let status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;

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
