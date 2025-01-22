const httpStatus = require("http-status");
const isEmpty = require("is-empty");
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
  `${constants.ENVIRONMENT} -- uptime-controller`
);
const createUptimeUtil = require("@utils/uptime.util");

function handleResponse({
  result,
  key = "data",
  errorKey = "errors",
  res,
} = {}) {
  if (!result) {
    return;
  }

  const isSuccess = result.success;
  const defaultStatus = isSuccess
    ? httpStatus.OK
    : httpStatus.INTERNAL_SERVER_ERROR;

  const defaultMessage = isSuccess
    ? "Operation Successful"
    : "Internal Server Error";

  const status = result.status !== undefined ? result.status : defaultStatus;
  const message =
    result.message !== undefined ? result.message : defaultMessage;
  const data = result.data !== undefined ? result.data : [];
  const errors = isSuccess
    ? undefined
    : result.errors !== undefined
    ? result.errors
    : { message: "Internal Server Error" };

  return res.status(status).json({ message, [key]: data, [errorKey]: errors });
}

const uptime = {
  getDeviceStatus: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { startDate, endDate, limit } = request.query;

      const result = await createUptimeUtil.getDeviceStatus(
        {
          tenant: request.query.tenant,
          startDate,
          endDate,
          limit,
        },
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      handleResponse({ result, res });
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

  getNetworkUptime: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { startDate, endDate } = request.query;

      const result = await createUptimeUtil.getNetworkUptime(
        {
          tenant: request.query.tenant,
          startDate,
          endDate,
        },
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      handleResponse({ result, res });
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

  getDeviceUptime: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { startDate, endDate, devices, deviceName } = request.query;

      const result = await createUptimeUtil.getDeviceUptime(
        {
          tenant: request.query.tenant,
          startDate,
          endDate,
          devices,
          deviceName,
        },
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      handleResponse({ result, res });
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

  getDeviceBattery: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const {
        deviceName,
        startDate,
        endDate,
        minutesAverage,
        rounding,
      } = req.query;

      const result = await createUptimeUtil.getDeviceBattery(
        {
          deviceName,
          startDate,
          endDate,
          minutesAverage,
          rounding,
        },
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      handleResponse({ result, res });
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

  getDeviceUptimeLeaderboard: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const { startDate, endDate } = request.query;

      const result = await createUptimeUtil.getDeviceUptimeLeaderboard(
        {
          tenant: request.query.tenant,
          startDate,
          endDate,
        },
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      handleResponse({ result, res });
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

module.exports = uptime;
