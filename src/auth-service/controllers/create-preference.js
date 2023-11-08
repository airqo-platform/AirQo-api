const httpStatus = require("http-status");
const { logElement, logText, logObject } = require("@utils/log");
const createPreferenceUtil = require("@utils/create-preference");
const { validationResult } = require("express-validator");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- preferences-controller`
);
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");

const preferences = {
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

      let request = Object.assign({}, req);
      if (isEmpty(request.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let responseFromUpdateDefault = await createPreferenceUtil.update(
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
          preference: responseFromUpdateDefault.data,
        });
      } else if (responseFromUpdateDefault.success === false) {
        let errors = responseFromUpdateDefault.errors
          ? responseFromUpdateDefault.errors
          : { message: "" };
        let status = responseFromUpdateDefault.status
          ? responseFromUpdateDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdateDefault.message,
          preference: responseFromUpdateDefault.data,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
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

      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let responseFromCreateDefault = await createPreferenceUtil.create(
        request
      );
      logObject("responseFromCreateDefault", responseFromCreateDefault);
      if (responseFromCreateDefault.success === true) {
        let status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateDefault.message,
          preference: responseFromCreateDefault.data,
        });
      } else if (responseFromCreateDefault.success === false) {
        let errors = responseFromCreateDefault.errors
          ? responseFromCreateDefault.errors
          : { message: "" };
        let status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateDefault.message,
          preference: responseFromCreateDefault.data,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  upsert: async (req, res) => {
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

      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let responseFromCreateDefault = await createPreferenceUtil.upsert(
        request
      );
      logObject("responseFromCreateDefault", responseFromCreateDefault);
      if (responseFromCreateDefault.success === true) {
        let status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateDefault.message,
          preference: responseFromCreateDefault.data,
        });
      } else if (responseFromCreateDefault.success === false) {
        let errors = responseFromCreateDefault.errors
          ? responseFromCreateDefault.errors
          : { message: "" };
        let status = responseFromCreateDefault.status
          ? responseFromCreateDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateDefault.message,
          preference: responseFromCreateDefault.data,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      logText(".....................................");
      logText("list all preferences by query params provided");
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
      if (isEmpty(request.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromListDefaults = await createPreferenceUtil.list(request);
      if (responseFromListDefaults.success === true) {
        let status = responseFromListDefaults.status
          ? responseFromListDefaults.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListDefaults.message,
          preferences: responseFromListDefaults.data,
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
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
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

      let request = Object.assign({}, req);
      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromDeleteDefault = await createPreferenceUtil.delete(
        request
      );
      logObject("responseFromDeleteDefault", responseFromDeleteDefault);
      if (responseFromDeleteDefault.success === true) {
        let status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeleteDefault.message,
          preference: responseFromDeleteDefault.data,
        });
      } else if (responseFromDeleteDefault.success === false) {
        let errors = responseFromDeleteDefault.errors
          ? responseFromDeleteDefault.errors
          : { message: "" };

        let status = responseFromDeleteDefault.status
          ? responseFromDeleteDefault.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromDeleteDefault.message,
          preference: responseFromDeleteDefault.data,
          errors,
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = preferences;
