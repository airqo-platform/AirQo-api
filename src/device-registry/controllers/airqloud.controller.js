const httpStatus = require("http-status");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const createAirQloudUtil = require("@utils/airqloud.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- airqloud-controller`
);

const handleRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }
  const request = req;
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  request.query.tenant = isEmpty(req.query.tenant)
    ? defaultTenant
    : req.query.tenant;
  return request;
};

const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    })
  );
};

function handleResponse({ res, result, key = "data" }) {
  if (!result || res.headersSent) {
    return;
  }

  const { success, status, data, message, errors, ...rest } = result;

  const responseStatus =
    status || (success ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR);

  if (success) {
    const responseBody = {
      success: true,
      message: message || "Operation Successful",
      ...rest,
    };
    if (data !== undefined) {
      responseBody[key] = data;
    }
    return res.status(responseStatus).json(responseBody);
  } else {
    return res.status(responseStatus).json({
      success: false,
      message: message || "An unexpected error occurred.",
      errors: errors || { message: "An unexpected error occurred." },
    });
  }
}

const createAirqloud = {
  bulkCreate: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      // This functionality is not yet implemented.
      return handleResponse({
        res,
        result: {
          success: false,
          message: "NOT YET IMPLEMENTED",
          status: httpStatus.NOT_IMPLEMENTED,
          errors: { message: "NOT YET IMPLEMENTED" },
        },
      });
    } catch (error) {
      handleError(error, next);
    }
  },
  register: async (req, res, next) => {
    logText("registering airqloud.............");
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createAirQloudUtil.create(request, next);
      handleResponse({ res, result, key: "airqloud" });
    } catch (error) {
      handleError(error, next);
    }
  },
  calculateGeographicalCenter: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createAirQloudUtil.calculateGeographicalCenter(
        request,
        next
      );
      handleResponse({ res, result, key: "center_point" });
    } catch (error) {
      handleError(error, next);
    }
  },
  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete airqloud............");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createAirQloudUtil.delete(request, next);
      handleResponse({ res, result, key: "airqloud" });
    } catch (error) {
      handleError(error, next);
    }
  },
  refresh: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createAirQloudUtil.refresh(request, next);
      handleResponse({ res, result, key: "refreshed_airqloud" });
    } catch (error) {
      handleError(error, next);
    }
  },
  findSites: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createAirQloudUtil.findSites(request, next);
      handleResponse({ res, result, key: "sites" });
    } catch (error) {
      handleError(error, next);
    }
  },
  update: async (req, res, next) => {
    try {
      logText("updating airqloud................");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createAirQloudUtil.update(request, next);
      handleResponse({ res, result, key: "airqloud" });
    } catch (error) {
      handleError(error, next);
    }
  },
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all airqlouds by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await createAirQloudUtil.list(request, next);
      handleResponse({ res, result, key: "airqlouds" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listSummary: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all airqlouds by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      request.query.detailLevel = "summary";

      const result = await createAirQloudUtil.list(request, next);
      handleResponse({ res, result, key: "airqlouds" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listDashboard: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all airqlouds by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      request.query.detailLevel = "full";

      const result = await createAirQloudUtil.list(request, next);
      handleResponse({ res, result, key: "airqlouds" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listCohortsAndGrids: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all Cohorts and Grids by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      request.query.dashboard = "yes";

      const result = await createAirQloudUtil.listCohortsAndGrids(
        request,
        next
      );
      handleResponse({ res, result, key: "airqlouds" });
    } catch (error) {
      handleError(error, next);
    }
  },
  listCohortsAndGridsSummary: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all Cohorts and Grids by query params provided");
      const request = handleRequest(req, next);
      if (!request) return;

      request.query.detailLevel = "summary";

      const result = await createAirQloudUtil.listCohortsAndGrids(
        request,
        next
      );
      handleResponse({ res, result, key: "airqlouds" });
    } catch (error) {
      handleError(error, next);
    }
  },
};

module.exports = createAirqloud;
