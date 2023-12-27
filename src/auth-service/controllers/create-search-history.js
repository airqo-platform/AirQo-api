const createSearchHistoryUtil = require("@utils/create-search-history");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-search-history-controller`
);

const createSearchHistory = {
  syncSearchHistory: async (req, res, next) => {
    try {
      logText("Syncing Search History.....");
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

      const responseFromSyncSearchHistories =
        await createSearchHistoryUtil.syncSearchHistories(request, next);

      if (responseFromSyncSearchHistories.success === true) {
        const status = responseFromSyncSearchHistories.status
          ? responseFromSyncSearchHistories.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromSyncSearchHistories.message
            ? responseFromSyncSearchHistories.message
            : "",
          search_histories: responseFromSyncSearchHistories.data
            ? responseFromSyncSearchHistories.data
            : [],
        });
      } else if (responseFromSyncSearchHistories.success === false) {
        const status = responseFromSyncSearchHistories.status
          ? responseFromSyncSearchHistories.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromSyncSearchHistories.message
            ? responseFromSyncSearchHistories.message
            : "",
          errors: responseFromSyncSearchHistories.errors
            ? responseFromSyncSearchHistories.errors
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
      logText("creating Search History.....");
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

      const responseFromCreatesearchHistory =
        await createSearchHistoryUtil.create(request, next);

      if (responseFromCreatesearchHistory.success === true) {
        const status = responseFromCreatesearchHistory.status
          ? responseFromCreatesearchHistory.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreatesearchHistory.message
            ? responseFromCreatesearchHistory.message
            : "",
          created_search_history: responseFromCreatesearchHistory.data
            ? responseFromCreatesearchHistory.data
            : [],
        });
      } else if (responseFromCreatesearchHistory.success === false) {
        const status = responseFromCreatesearchHistory.status
          ? responseFromCreatesearchHistory.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreatesearchHistory.message
            ? responseFromCreatesearchHistory.message
            : "",
          errors: responseFromCreatesearchHistory.errors
            ? responseFromCreatesearchHistory.errors
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

      const responseFromListSearchHistories =
        await createSearchHistoryUtil.list(request, next);

      if (responseFromListSearchHistories.success === true) {
        const status = responseFromListSearchHistories.status
          ? responseFromListSearchHistories.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListSearchHistories.message
            ? responseFromListSearchHistories.message
            : "",
          search_histories: responseFromListSearchHistories.data
            ? responseFromListSearchHistories.data
            : [],
        });
      } else if (responseFromListSearchHistories.success === false) {
        const status = responseFromListSearchHistories.status
          ? responseFromListSearchHistories.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListSearchHistories.message
            ? responseFromListSearchHistories.message
            : "",
          errors: responseFromListSearchHistories.errors
            ? responseFromListSearchHistories.errors
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

      const responseFromDeleteSearchHistories =
        await createSearchHistoryUtil.delete(request, next);

      if (responseFromDeleteSearchHistories.success === true) {
        const status = responseFromDeleteSearchHistories.status
          ? responseFromDeleteSearchHistories.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteSearchHistories.message
            ? responseFromDeleteSearchHistories.message
            : "",
          deleted_search_histories: responseFromDeleteSearchHistories.data
            ? responseFromDeleteSearchHistories.data
            : [],
        });
      } else if (responseFromDeleteSearchHistories.success === false) {
        const status = responseFromDeleteSearchHistories.status
          ? responseFromDeleteSearchHistories.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteSearchHistories.message
            ? responseFromDeleteSearchHistories.message
            : "",
          errors: responseFromDeleteSearchHistories.errors
            ? responseFromDeleteSearchHistories.errors
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

      const responseFromUpdateSearchHistories =
        await createSearchHistoryUtil.update(request, next);

      if (responseFromUpdateSearchHistories.success === true) {
        const status = responseFromUpdateSearchHistories.status
          ? responseFromUpdateSearchHistories.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateSearchHistories.message
            ? responseFromUpdateSearchHistories.message
            : "",
          updated_search_history: responseFromUpdateSearchHistories.data
            ? responseFromUpdateSearchHistories.data
            : [],
        });
      } else if (responseFromUpdateSearchHistories.success === false) {
        const status = responseFromUpdateSearchHistories.status
          ? responseFromUpdateSearchHistories.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateSearchHistories.message
            ? responseFromUpdateSearchHistories.message
            : "",
          errors: responseFromUpdateSearchHistories.errors
            ? responseFromUpdateSearchHistories.errors
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

module.exports = createSearchHistory;
