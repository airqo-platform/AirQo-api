const httpStatus = require("http-status");
const groupChartConfigUtil = require("@utils/group-chart-config.util");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- group-chart-config-controller`
);
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");

const sendResponse = (res, result) => {
  if (result.success) {
    res.status(result.status || httpStatus.OK).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } else {
    res.status(result.status || httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: result.message,
      errors: result.errors,
    });
  }
};

const groupChartConfigController = {
  create: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = {
        ...req,
        body: {
          ...req.body,
          groupId: req.params.grp_id,
          deviceId: req.params.deviceId,
        },
      };
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await groupChartConfigUtil.create(request, next);
      sendResponse(res, result);
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

  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = {
        ...req,
        params: {
          ...req.params,
          groupId: req.params.grp_id,
        },
      };
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await groupChartConfigUtil.update(request, next);
      sendResponse(res, result);
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

  delete: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = {
        ...req,
        params: {
          ...req.params,
          groupId: req.params.grp_id,
        },
      };
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await groupChartConfigUtil.delete(request, next);
      sendResponse(res, result);
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

  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = {
        ...req,
        params: {
          ...req.params,
          groupId: req.params.grp_id,
        },
      };
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await groupChartConfigUtil.list(request, next);
      sendResponse(res, result);
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

  getById: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = {
        ...req,
        params: {
          ...req.params,
          groupId: req.params.grp_id,
        },
      };
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await groupChartConfigUtil.getById(request, next);
      sendResponse(res, result);
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

module.exports = groupChartConfigController;
