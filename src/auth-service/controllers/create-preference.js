const httpStatus = require("http-status");
const { logText, logObject } = require("@utils/log");
const createPreferenceUtil = require("@utils/create-preference");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- preferences-controller`
);
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");

const preferences = {
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

      const responseFromUpdatePreference = await createPreferenceUtil.update(
        request,
        next
      );

      if (responseFromUpdatePreference.success === true) {
        const status = responseFromUpdatePreference.status
          ? responseFromUpdatePreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdatePreference.message,
          preference: responseFromUpdatePreference.data,
        });
      } else if (responseFromUpdatePreference.success === false) {
        const status = responseFromUpdatePreference.status
          ? responseFromUpdatePreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdatePreference.message,
          preference: responseFromUpdatePreference.data,
          errors: responseFromUpdatePreference.errors
            ? responseFromUpdatePreference.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

      const responseFromCreatePreference = await createPreferenceUtil.create(
        request,
        next
      );
      if (responseFromCreatePreference.success === true) {
        const status = responseFromCreatePreference.status
          ? responseFromCreatePreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreatePreference.message,
          preference: responseFromCreatePreference.data,
        });
      } else if (responseFromCreatePreference.success === false) {
        const status = responseFromCreatePreference.status
          ? responseFromCreatePreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreatePreference.message,
          preference: responseFromCreatePreference.data,
          errors: responseFromCreatePreference.errors
            ? responseFromCreatePreference.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  upsert: async (req, res, next) => {
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

      const responseFromUpsertPreference = await createPreferenceUtil.upsert(
        request,
        next
      );

      if (responseFromUpsertPreference.success === true) {
        const status = responseFromUpsertPreference.status
          ? responseFromUpsertPreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpsertPreference.message,
          preference: responseFromUpsertPreference.data,
        });
      } else if (responseFromUpsertPreference.success === false) {
        const status = responseFromUpsertPreference.status
          ? responseFromUpsertPreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpsertPreference.message,
          preference: responseFromUpsertPreference.data,
          errors: responseFromUpsertPreference.errors
            ? responseFromUpsertPreference.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  replace: async (req, res, next) => {
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

      const responseFromReplacePreference = await createPreferenceUtil.replace(
        request,
        next
      );

      if (responseFromReplacePreference.success === true) {
        const status = responseFromReplacePreference.status
          ? responseFromReplacePreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromReplacePreference.message,
          preference: responseFromReplacePreference.data,
        });
      } else if (responseFromReplacePreference.success === false) {
        const status = responseFromReplacePreference.status
          ? responseFromReplacePreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromReplacePreference.message,
          preference: responseFromReplacePreference.data,
          errors: responseFromReplacePreference.errors
            ? responseFromReplacePreference.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
      logText("list all preferences by query params provided");
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

      const responseFromListPreferences = await createPreferenceUtil.list(
        request,
        next
      );
      if (responseFromListPreferences.success === true) {
        const status = responseFromListPreferences.status
          ? responseFromListPreferences.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListPreferences.message,
          preferences: responseFromListPreferences.data,
        });
      } else if (responseFromListPreferences.success === false) {
        const status = responseFromListPreferences.status
          ? responseFromListPreferences.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListPreferences.message,
          errors: responseFromListPreferences.errors
            ? responseFromListPreferences.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
      logText("deleting preference..........");
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

      const responseFromDeletePreference = await createPreferenceUtil.delete(
        request,
        next
      );
      logObject("responseFromDeletePreference", responseFromDeletePreference);
      if (responseFromDeletePreference.success === true) {
        const status = responseFromDeletePreference.status
          ? responseFromDeletePreference.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeletePreference.message,
          preference: responseFromDeletePreference.data,
        });
      } else if (responseFromDeletePreference.success === false) {
        const status = responseFromDeletePreference.status
          ? responseFromDeletePreference.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeletePreference.message,
          preference: responseFromDeletePreference.data,
          errors: responseFromDeletePreference.errors
            ? responseFromDeletePreference.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

module.exports = preferences;
