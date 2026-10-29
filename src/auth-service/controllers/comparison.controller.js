const comparisonUtil = require("@utils/comparison.util");
const {
  logText,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-comparison-controller`
);

const withDefaultTenant = (req) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  req.query.tenant = isEmpty(req.query.tenant) ? defaultTenant : req.query.tenant;
  return req;
};

const createComparison = {
  create: async (req, res, next) => {
    try {
      logText("creating comparison.....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = withDefaultTenant(req);
      const result = await comparisonUtil.create(request, next);

      if (isEmpty(result) || res.headersSent) return;
      if (result.success === true) {
        // createSuccessResponse() always sets status 200 for "create" — this
        // endpoint's contract requires 201, so it's forced here rather than
        // deferred to result.status.
        return res.status(httpStatus.CREATED).json({
          success: true,
          message: result.message || "Comparison created",
          comparison: result.data,
        });
      }
      return res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: result.message || "",
        errors: result.errors || { message: "Internal Server Error" },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = withDefaultTenant(req);
      const result = await comparisonUtil.list(request, next);

      if (isEmpty(result) || res.headersSent) return;
      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        return res.status(status).json({
          success: true,
          message: result.message || "",
          comparisons: result.data || [],
          meta: result.meta || {},
        });
      }
      return res.status(status).json({
        success: false,
        message: result.message || "",
        errors: result.errors || { message: "Internal Server Error" },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  getById: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = withDefaultTenant(req);
      const result = await comparisonUtil.getById(request, next);

      if (isEmpty(result) || res.headersSent) return;
      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        return res.status(status).json({
          success: true,
          message: result.message || "",
          comparison: result.data,
        });
      }
      return res.status(status).json({
        success: false,
        message: result.message || "",
        errors: result.errors || { message: "Internal Server Error" },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = withDefaultTenant(req);
      const result = await comparisonUtil.update(request, next);

      if (isEmpty(result) || res.headersSent) return;
      const status = result.status || httpStatus.OK;
      if (result.success === true) {
        return res.status(status).json({
          success: true,
          message: result.message || "",
          comparison: result.data,
        });
      }
      return res.status(status).json({
        success: false,
        message: result.message || "",
        errors: result.errors || { message: "Internal Server Error" },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  delete: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = withDefaultTenant(req);
      const result = await comparisonUtil.remove(request, next);

      if (isEmpty(result) || res.headersSent) return;
      if (result.success === true) {
        return res.status(httpStatus.NO_CONTENT).send();
      }
      const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
      return res.status(status).json({
        success: false,
        message: result.message || "",
        errors: result.errors || { message: "Internal Server Error" },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

module.exports = createComparison;
