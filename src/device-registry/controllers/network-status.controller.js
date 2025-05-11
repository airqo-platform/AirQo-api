const httpStatus = require("http-status");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-status-controller`
);
const networkStatusUtil = require("@utils/network-status.util");
const isEmpty = require("is-empty");

const networkStatusController = {
  create: async (req, res, next) => {
    try {
      const hasErrors = extractErrorsFromRequest(req);
      if (hasErrors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, hasErrors)
        );
        return;
      }

      const { body, query } = req;
      const { tenant } = query;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const result = await networkStatusUtil.createAlert(
        {
          alertData: body,
          tenant: actualTenant,
        },
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status || httpStatus.CREATED;
        res.status(status).json({
          success: true,
          message: result.message,
          alert: result.data,
        });
      } else if (result.success === false) {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors || { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  list: async (req, res, next) => {
    try {
      const hasErrors = extractErrorsFromRequest(req);
      if (hasErrors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, hasErrors)
        );
        return;
      }

      const { query } = req;
      const { tenant } = query;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const request = req;
      request.query.tenant = actualTenant;

      const result = await networkStatusUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          alerts: result.data,
        });
      } else if (result.success === false) {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors || { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  getStatistics: async (req, res, next) => {
    try {
      const hasErrors = extractErrorsFromRequest(req);
      if (hasErrors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, hasErrors)
        );
        return;
      }

      const { query } = req;
      const { tenant } = query;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const request = req;
      request.query.tenant = actualTenant;

      const result = await networkStatusUtil.getStatistics(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          statistics: result.data,
        });
      } else if (result.success === false) {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors || { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  getHourlyTrends: async (req, res, next) => {
    try {
      const hasErrors = extractErrorsFromRequest(req);
      if (hasErrors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, hasErrors)
        );
        return;
      }

      const { query } = req;
      const { tenant } = query;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const request = req;
      request.query.tenant = actualTenant;

      const result = await networkStatusUtil.getHourlyTrends(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          trends: result.data,
        });
      } else if (result.success === false) {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors || { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  getRecentAlerts: async (req, res, next) => {
    try {
      const hasErrors = extractErrorsFromRequest(req);
      if (hasErrors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, hasErrors)
        );
        return;
      }

      const { query } = req;
      const { tenant } = query;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const request = req;
      request.query.tenant = actualTenant;

      const result = await networkStatusUtil.getRecentAlerts(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          alerts: result.data,
        });
      } else if (result.success === false) {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors || { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  getUptimeSummary: async (req, res, next) => {
    try {
      const hasErrors = extractErrorsFromRequest(req);
      if (hasErrors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, hasErrors)
        );
        return;
      }

      const { query } = req;
      const { tenant } = query;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const request = req;
      request.query.tenant = actualTenant;

      const result = await networkStatusUtil.getUptimeSummary(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          summary: result.data,
        });
      } else if (result.success === false) {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors || { message: "" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
};

module.exports = networkStatusController;
