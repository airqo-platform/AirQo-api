const httpStatus = require("http-status");
const { logText, logObject } = require("@utils/log");
const createDefaultUtil = require("@utils/create-default");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- defaults-controller`
);
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");

const defaults = {
  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateDefault = await createDefaultUtil.update(
        request,
        next
      );

      if (responseFromUpdateDefault.success === true) {
        const status = responseFromUpdateDefault.status
          ? responseFromUpdateDefault.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdateDefault.message,
          default: responseFromUpdateDefault.data,
        });
      } else if (responseFromUpdateDefault.success === false) {
        const status = responseFromUpdateDefault.status
          ? responseFromUpdateDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdateDefault.message,
          default: responseFromUpdateDefault.data,
          errors: responseFromUpdateDefault.errors
            ? responseFromUpdateDefault.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateDefault = await createDefaultUtil.create(
        request,
        next
      );
      logObject("responseFromCreateDefault", responseFromCreateDefault);
      if (responseFromCreateDefault.success === true) {
        const status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateDefault.message,
          default: responseFromCreateDefault.data,
        });
      } else if (responseFromCreateDefault.success === false) {
        const status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateDefault.message,
          default: responseFromCreateDefault.data,
          errors: responseFromCreateDefault.errors
            ? responseFromCreateDefault.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all defaults by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListDefaults = await createDefaultUtil.list(
        request,
        next
      );
      if (responseFromListDefaults.success === true) {
        const status = responseFromListDefaults.status
          ? responseFromListDefaults.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListDefaults.message,
          defaults: responseFromListDefaults.data,
        });
      } else if (responseFromListDefaults.success === false) {
        const status = responseFromListDefaults.status
          ? responseFromListDefaults.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListDefaults.message,
          errors: responseFromListDefaults.errors
            ? responseFromListDefaults.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (req, res, next) => {
    try {
      logText("deleting default..........");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromDeleteDefault = await createDefaultUtil.delete(
        request,
        next
      );

      if (responseFromDeleteDefault.success === true) {
        const status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeleteDefault.message,
          default: responseFromDeleteDefault.data,
        });
      } else if (responseFromDeleteDefault.success === false) {
        const status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeleteDefault.message,
          default: responseFromDeleteDefault.data,
          errors: responseFromDeleteDefault.errors
            ? responseFromDeleteDefault.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = defaults;
