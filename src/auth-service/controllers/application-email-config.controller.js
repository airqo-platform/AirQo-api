const applicationEmailConfigUtil = require("@utils/application-email-config.util");
const { logObject, HttpError, extractErrorsFromRequest } = require("@utils/shared");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- application-email-config-controller`
);

const applicationEmailConfig = {
  create: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }

      const result = await applicationEmailConfigUtil.create(req, next);
      if (isEmpty(result) || res.headersSent) return;

      if (result.success === true) {
        const status = result.status || httpStatus.CREATED;
        return res.status(status).json({
          success: true,
          message: result.message || "",
          applicationEmailConfiguration: result.data || {},
        });
      } else {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message || "",
          errors: result.errors || { message: "" },
        });
      }
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

      const result = await applicationEmailConfigUtil.list(req, next);
      if (isEmpty(result) || res.headersSent) return;

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message || "",
          applicationEmailConfigurations: result.data || [],
          total: result.totalCount,
        });
      } else {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message || "",
          errors: result.errors || { message: "" },
        });
      }
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

      const result = await applicationEmailConfigUtil.update(req, next);
      if (isEmpty(result) || res.headersSent) return;

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message || "",
          applicationEmailConfiguration: result.data || {},
        });
      } else {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message || "",
          errors: result.errors || { message: "" },
        });
      }
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

      const result = await applicationEmailConfigUtil.remove(req, next);
      if (isEmpty(result) || res.headersSent) return;

      if (result.success === true) {
        const status = result.status || httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message || "",
          applicationEmailConfiguration: result.data || {},
        });
      } else {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message || "",
          errors: result.errors || { message: "" },
        });
      }
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

module.exports = applicationEmailConfig;
