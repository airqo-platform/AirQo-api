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

// Helper function to handle errors
const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    })
  );
};

// Helper function to validate request
const validateRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return false;
  }
  return true;
};

// Helper function to get tenant from request
const getTenantFromRequest = (req) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  return isEmpty(req.query.tenant) ? defaultTenant : req.query.tenant;
};

// Helper function to handle response
const sendResponse = (res, result) => {
  if (result.success === true) {
    const status = result.status || httpStatus.OK;
    res.status(status).json({
      success: true,
      message: result.message,
      [result.dataKey || "data"]: result.data || [],
    });
  } else {
    const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
    res.status(status).json({
      success: false,
      message: result.message,
      errors: result.errors || { message: "" },
    });
  }
};

// Generic controller action handler
const handleControllerAction = async (
  req,
  res,
  next,
  utilFunction,
  dataKey
) => {
  try {
    if (!validateRequest(req, next)) return;

    const tenant = getTenantFromRequest(req);

    // Create a new request object with modified query
    const modifiedRequest = {
      ...req,
      query: {
        ...req.query,
        tenant,
      },
    };

    const result = await utilFunction(modifiedRequest, next);

    if (isEmpty(result) || res.headersSent) return;

    result.dataKey = dataKey;
    sendResponse(res, result);
  } catch (error) {
    handleError(error, next);
  }
};

const networkStatusController = {
  create: async (req, res, next) => {
    try {
      if (!validateRequest(req, next)) return;

      const { body, query } = req;
      const tenant = getTenantFromRequest(req);

      const result = await networkStatusUtil.createAlert(
        {
          alertData: body,
          tenant: tenant,
        },
        next
      );

      if (isEmpty(result) || res.headersSent) return;

      result.dataKey = "alert";
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },

  list: async (req, res, next) => {
    await handleControllerAction(
      req,
      res,
      next,
      networkStatusUtil.list,
      "alerts"
    );
  },

  getStatistics: async (req, res, next) => {
    await handleControllerAction(
      req,
      res,
      next,
      networkStatusUtil.getStatistics,
      "statistics"
    );
  },

  getHourlyTrends: async (req, res, next) => {
    await handleControllerAction(
      req,
      res,
      next,
      networkStatusUtil.getHourlyTrends,
      "trends"
    );
  },

  getRecentAlerts: async (req, res, next) => {
    await handleControllerAction(
      req,
      res,
      next,
      networkStatusUtil.getRecentAlerts,
      "alerts"
    );
  },

  getUptimeSummary: async (req, res, next) => {
    await handleControllerAction(
      req,
      res,
      next,
      networkStatusUtil.getUptimeSummary,
      "summary"
    );
  },
};

module.exports = networkStatusController;
