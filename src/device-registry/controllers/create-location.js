const httpStatus = require("http-status");
const { logText } = require("@utils/log");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const createLocationUtil = require("@utils/create-location");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-location-controller`
);

const createLocation = {
  register: async (req, res, next) => {
    logText("registering location.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateLocation = await createLocationUtil.create(
        request,
        next
      );

      if (responseFromCreateLocation.success === true) {
        const status = responseFromCreateLocation.status
          ? responseFromCreateLocation.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateLocation.message,
          location: responseFromCreateLocation.data,
        });
      } else if (responseFromCreateLocation.success === false) {
        const status = responseFromCreateLocation.status
          ? responseFromCreateLocation.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateLocation.message,
          errors: responseFromCreateLocation.errors
            ? responseFromCreateLocation.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete location............");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveLocation = await createLocationUtil.delete(
        request,
        next
      );

      if (responseFromRemoveLocation.success === true) {
        const status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveLocation.message,
          location: responseFromRemoveLocation.data,
        });
      } else if (responseFromRemoveLocation.success === false) {
        const status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveLocation.message,
          errors: responseFromRemoveLocation.errors
            ? responseFromRemoveLocation.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  update: async (req, res, next) => {
    try {
      logText("updating location................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateLocation = await createLocationUtil.update(
        request,
        next
      );

      if (responseFromUpdateLocation.success === true) {
        const status = responseFromUpdateLocation.status
          ? responseFromUpdateLocation.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateLocation.message,
          location: responseFromUpdateLocation.data,
        });
      } else if (responseFromUpdateLocation.success === false) {
        const status = responseFromUpdateLocation.status
          ? responseFromUpdateLocation.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateLocation.message,
          errors: responseFromUpdateLocation.errors
            ? responseFromUpdateLocation.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listSummary: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all locations by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.summary = "yes";

      const responseFromListLocations = await createLocationUtil.list(
        request,
        next
      );

      if (responseFromListLocations.success === true) {
        const status = responseFromListLocations.status
          ? responseFromListLocations.status
          : httpStatus.OK;

        res.status(status).json({
          success: true,
          message: responseFromListLocations.message,
          airqlouds: responseFromListLocations.data,
        });
      } else if (responseFromListLocations.success === false) {
        const status = responseFromListLocations.status
          ? responseFromListLocations.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListLocations.message,
          errors: responseFromListLocations.errors
            ? responseFromListLocations.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all locations by query params provided");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListLocations = await createLocationUtil.list(
        request,
        next
      );

      if (responseFromListLocations.success === true) {
        const status = responseFromListLocations.status
          ? responseFromListLocations.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListLocations.message,
          locations: responseFromListLocations.data,
        });
      } else if (responseFromListLocations.success === false) {
        const status = responseFromListLocations.status
          ? responseFromListLocations.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListLocations.message,
          errors: responseFromListLocations.errors
            ? responseFromListLocations.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete location............");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveLocation = await createLocationUtil.delete(
        request,
        next
      );

      if (responseFromRemoveLocation.success === true) {
        const status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveLocation.message,
          location: responseFromRemoveLocation.data,
        });
      } else if (responseFromRemoveLocation.success === false) {
        const status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveLocation.message,
          errors: responseFromRemoveLocation.errors
            ? responseFromRemoveLocation.errors
            : { message: "" },
        });
      }
    } catch (errors) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = createLocation;
