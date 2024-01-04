const createLocationHistoryUtil = require("@utils/create-location-history");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-location-history-controller`
);

const createLocationHistory = {
  syncLocationHistory: async (req, res, next) => {
    try {
      logText("Syncing Location History.....");
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

      const syncLocationHistoriesResponse =
        await createLocationHistoryUtil.syncLocationHistories(request, next);

      if (syncLocationHistoriesResponse.success === true) {
        const status = syncLocationHistoriesResponse.status
          ? syncLocationHistoriesResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: syncLocationHistoriesResponse.message
            ? syncLocationHistoriesResponse.message
            : "",
          location_histories: syncLocationHistoriesResponse.data
            ? syncLocationHistoriesResponse.data
            : [],
        });
      } else if (syncLocationHistoriesResponse.success === false) {
        const status = syncLocationHistoriesResponse.status
          ? syncLocationHistoriesResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: syncLocationHistoriesResponse.message
            ? syncLocationHistoriesResponse.message
            : "",
          errors: syncLocationHistoriesResponse.errors
            ? syncLocationHistoriesResponse.errors
            : { message: "Internal Server Error" },
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
      logText("creating Location History.....");
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

      const locationHistoryResponse = await createLocationHistoryUtil.create(
        request,
        next
      );

      if (locationHistoryResponse.success === true) {
        const status = locationHistoryResponse.status
          ? locationHistoryResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: locationHistoryResponse.message
            ? locationHistoryResponse.message
            : "",
          created_location_history: locationHistoryResponse.data
            ? locationHistoryResponse.data
            : [],
        });
      } else if (locationHistoryResponse.success === false) {
        const status = locationHistoryResponse.status
          ? locationHistoryResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: locationHistoryResponse.message
            ? locationHistoryResponse.message
            : "",
          errors: locationHistoryResponse.errors
            ? locationHistoryResponse.errors
            : { message: "Internal Server Error" },
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

      const locationHistoriesResponse = await createLocationHistoryUtil.list(
        request,
        next
      );

      if (locationHistoriesResponse.success === true) {
        const status = locationHistoriesResponse.status
          ? locationHistoriesResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: locationHistoriesResponse.message
            ? locationHistoriesResponse.message
            : "",
          location_histories: locationHistoriesResponse.data
            ? locationHistoriesResponse.data
            : [],
        });
      } else if (locationHistoriesResponse.success === false) {
        const status = locationHistoriesResponse.status
          ? locationHistoriesResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: locationHistoriesResponse.message
            ? locationHistoriesResponse.message
            : "",
          errors: locationHistoriesResponse.errors
            ? locationHistoriesResponse.errors
            : { message: "Internal Server Error" },
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

      const deleteLocationHistoriesResponse =
        await createLocationHistoryUtil.delete(request, next);

      if (deleteLocationHistoriesResponse.success === true) {
        const status = deleteLocationHistoriesResponse.status
          ? deleteLocationHistoriesResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: deleteLocationHistoriesResponse.message
            ? deleteLocationHistoriesResponse.message
            : "",
          deleted_location_histories: deleteLocationHistoriesResponse.data
            ? deleteLocationHistoriesResponse.data
            : [],
        });
      } else if (deleteLocationHistoriesResponse.success === false) {
        const status = deleteLocationHistoriesResponse.status
          ? deleteLocationHistoriesResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: deleteLocationHistoriesResponse.message
            ? deleteLocationHistoriesResponse.message
            : "",
          errors: deleteLocationHistoriesResponse.errors
            ? deleteLocationHistoriesResponse.errors
            : { message: "Internal Server Error" },
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

      const updateLocationHistoriesResponse =
        await createLocationHistoryUtil.update(request, next);

      if (updateLocationHistoriesResponse.success === true) {
        const status = updateLocationHistoriesResponse.status
          ? updateLocationHistoriesResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: updateLocationHistoriesResponse.message
            ? updateLocationHistoriesResponse.message
            : "",
          updated_location_history: updateLocationHistoriesResponse.data
            ? updateLocationHistoriesResponse.data
            : [],
        });
      } else if (updateLocationHistoriesResponse.success === false) {
        const status = updateLocationHistoriesResponse.status
          ? updateLocationHistoriesResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: updateLocationHistoriesResponse.message
            ? updateLocationHistoriesResponse.message
            : "",
          errors: updateLocationHistoriesResponse.errors
            ? updateLocationHistoriesResponse.errors
            : { message: "Internal Server Error" },
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

module.exports = createLocationHistory;
