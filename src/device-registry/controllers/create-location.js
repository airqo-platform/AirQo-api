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

  const status = result.status ?? defaultStatus;
  const message = result.message ?? defaultMessage;
  const data = result.data ?? [];
  const errors = isSuccess
    ? undefined
    : result.errors ?? { message: "Internal Server Error" };

  return res.status(status).json({ message, [key]: data, [errorKey]: errors });
}

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

      const result = await createLocationUtil.create(request, next);

      if (isEmpty(result)) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          location: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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

      const result = await createLocationUtil.delete(request, next);

      if (isEmpty(result)) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          location: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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

      const result = await createLocationUtil.update(request, next);

      if (isEmpty(result)) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          location: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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

      const result = await createLocationUtil.list(request, next);
      if (isEmpty(result)) {
        return;
      }
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;

        res.status(status).json({
          success: true,
          message: result.message,
          airqlouds: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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

      const result = await createLocationUtil.list(request, next);

      if (isEmpty(result)) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: result.message,
          locations: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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

      const result = await createLocationUtil.delete(request, next);

      if (isEmpty(result)) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          location: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors ? result.errors : { message: "" },
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
