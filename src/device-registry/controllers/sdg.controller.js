const httpStatus = require("http-status");
const {
  logText,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const sdgUtil = require("@utils/sdg.util");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- sdg-controller`);
const isEmpty = require("is-empty");

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

  const { success, status, data, message, errors, meta, ...rest } = result;

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
    if (meta !== undefined) {
      responseBody.meta = meta;
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

const sdgController = {
  /***************  City / Grid Metadata  ***************/

  createCity: async (req, res, next) => {
    try {
      logText("creating SDG city record...");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await sdgUtil.createCity(request, next);
      handleResponse({ res, result, key: "city" });
    } catch (error) {
      handleError(error, next);
    }
  },

  listCities: async (req, res, next) => {
    try {
      logText("listing SDG cities...");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await sdgUtil.listCities(request, next);
      handleResponse({ res, result, key: "data" });
    } catch (error) {
      handleError(error, next);
    }
  },

  listCitySites: async (req, res, next) => {
    try {
      logText("listing sites for SDG city...");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await sdgUtil.listCitySites(request, next);
      handleResponse({ res, result, key: "sites" });
    } catch (error) {
      handleError(error, next);
    }
  },

  /***************  Spreadsheet Upload  ***************/

  uploadCities: async (req, res, next) => {
    try {
      logText("processing SDG cities spreadsheet upload...");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await sdgUtil.uploadCities(request, next);
      handleResponse({ res, result, key: "data" });
    } catch (error) {
      handleError(error, next);
    }
  },

  /***************  Population Weight Configuration  ***************/

  listPopulationWeights: async (req, res, next) => {
    try {
      logText("listing SDG population weight configuration...");
      const request = handleRequest(req, next);
      if (!request) return;

      const result = await sdgUtil.listPopulationWeights(request, next);
      handleResponse({ res, result, key: "data" });
    } catch (error) {
      handleError(error, next);
    }
  },
};

module.exports = sdgController;
