const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- forecast-controller`
);
const forecastUtil = require("@utils/create-forecast");
const isEmpty = require("is-empty");

const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error ${error.message}`);
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: error.message,
    })
  );
};

const validateRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return false;
  }
  return true;
};

const getTenantFromRequest = (req) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  return isEmpty(req.query.tenant) ? defaultTenant : req.query.tenant;
};

const sendResponse = (res, result) => {
  if (result.success === true) {
    const status = result.status || httpStatus.OK;
    res.status(status).json({
      success: true,
      message: result.message,
      [result.dataKey || "forecast"]: result.data || [],
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

const handleControllerAction = async (
  req,
  res,
  next,
  utilFunction,
  dataKey
) => {
  try {
    if (!validateRequest(req, next)) return;

    const request = req;
    request.query.tenant = getTenantFromRequest(req);

    const result = await utilFunction(request, next);

    if (isEmpty(result) || res.headersSent) return;

    result.dataKey = dataKey;
    sendResponse(res, result);
  } catch (error) {
    handleError(error, next);
  }
};

const forecastController = {
  create: async (req, res, next) => {
    await handleControllerAction(
      req,
      res,
      next,
      forecastUtil.create,
      "forecast"
    );
  },

  listByDevice: async (req, res, next) => {
    await handleControllerAction(
      req,
      res,
      next,
      forecastUtil.listByDevice,
      "forecasts"
    );
  },

  listBySite: async (req, res, next) => {
    await handleControllerAction(
      req,
      res,
      next,
      forecastUtil.listBySite,
      "forecasts"
    );
  },
};

module.exports = forecastController;
