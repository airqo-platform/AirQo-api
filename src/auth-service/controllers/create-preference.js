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

      let responseFromUpdatePreference = await createPreferenceUtil.update(
        request
      );
      logObject("responseFromUpdatePreference", responseFromUpdatePreference);
      if (responseFromUpdatePreference.success === true) {
        let status = responseFromUpdatePreference.status
          ? responseFromUpdatePreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdatePreference.message,
          preference: responseFromUpdatePreference.data,
        });
      } else if (responseFromUpdatePreference.success === false) {
        let errors = responseFromUpdatePreference.errors
          ? responseFromUpdatePreference.errors
          : { message: "" };
        let status = responseFromUpdatePreference.status
          ? responseFromUpdatePreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePreference.message,
          preference: responseFromUpdatePreference.data,
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

      let responseFromCreatePreference = await createPreferenceUtil.create(
        request
      );
      logObject("responseFromCreatePreference", responseFromCreatePreference);
      if (responseFromCreatePreference.success === true) {
        let status = responseFromCreatePreference.status
          ? responseFromCreatePreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreatePreference.message,
          preference: responseFromCreatePreference.data,
        });
      } else if (responseFromCreatePreference.success === false) {
        let errors = responseFromCreatePreference.errors
          ? responseFromCreatePreference.errors
          : { message: "" };
        let status = responseFromCreatePreference.status
          ? responseFromCreatePreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePreference.message,
          preference: responseFromCreatePreference.data,
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

      let responseFromCreatePreference = await createPreferenceUtil.upsert(
        request
      );
      logObject("responseFromCreatePreference", responseFromCreatePreference);
      if (responseFromCreatePreference.success === true) {
        let status = responseFromCreatePreference.status
          ? responseFromCreatePreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreatePreference.message,
          preference: responseFromCreatePreference.data,
        });
      } else if (responseFromCreatePreference.success === false) {
        let errors = responseFromCreatePreference.errors
          ? responseFromCreatePreference.errors
          : { message: "" };
        let status = responseFromCreatePreference.status
          ? responseFromCreatePreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePreference.message,
          preference: responseFromCreatePreference.data,
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

      const responseFromListPreferences = await createPreferenceUtil.list(
        request
      );
      if (responseFromListPreferences.success === true) {
        let status = responseFromListPreferences.status
          ? responseFromListPreferences.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListPreferences.message,
          preferences: responseFromListPreferences.data,
        });
      } else if (responseFromListPreferences.success === false) {
        let errors = responseFromListPreferences.errors
          ? responseFromListPreferences.errors
          : "";

        let status = responseFromListPreferences.status
          ? responseFromListPreferences.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListPreferences.message,
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
      logText("deleting preference..........");
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
      const responseFromDeletePreference = await createPreferenceUtil.delete(
        request
      );
      logObject("responseFromDeletePreference", responseFromDeletePreference);
      if (responseFromDeletePreference.success === true) {
        let status = responseFromDeletePreference.status
          ? responseFromDeletePreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeletePreference.message,
          preference: responseFromDeletePreference.data,
        });
      } else if (responseFromDeletePreference.success === false) {
        let errors = responseFromDeletePreference.errors
          ? responseFromDeletePreference.errors
          : { message: "" };

        let status = responseFromDeletePreference.status
          ? responseFromDeletePreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromDeletePreference.message,
          preference: responseFromDeletePreference.data,
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
