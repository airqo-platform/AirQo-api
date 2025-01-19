const httpStatus = require("http-status");
const maintenanceUtil = require("@utils/maintenance.util");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- maintenances-controller`
);

const { handleResponse } = require("@utils/common");

const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const maintenances = {
  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const result = await maintenanceUtil.update(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      handleResponse(res, result, "maintenance");
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "An unexpected error occurred." }
        )
      );
      return;
    }
  },
  create: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const result = await maintenanceUtil.create(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      handleResponse(res, result, "maintenance");
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "An unexpected error occurred." }
        )
      );
      return;
    }
  },
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all maintenances by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const result = await maintenanceUtil.list(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      handleResponse(res, result, "maintenance");
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "An unexpected error occurred." }
        )
      );
      return;
    }
  },
  delete: async (req, res, next) => {
    try {
      logText("deleting maintenance..........");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await maintenanceUtil.delete(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      handleResponse(res, result, "maintenance");
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "An unexpected error occurred." }
        )
      );
      return;
    }
  },
};

module.exports = maintenances;
