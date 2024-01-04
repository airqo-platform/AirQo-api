const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-health-tip-controller`
);
const createHealthTipUtil = require("@utils/create-health-tips");
const isEmpty = require("is-empty");

const createHealthTips = {
  list: async (req, res, next) => {
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

      const responseFromListHealthTip = await createHealthTipUtil.list(
        request,
        next
      );

      if (responseFromListHealthTip.success === true) {
        const status = responseFromListHealthTip.status
          ? responseFromListHealthTip.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListHealthTip.message,
          tips: responseFromListHealthTip.data,
        });
      } else if (responseFromListHealthTip.success === false) {
        const status = responseFromListHealthTip.status
          ? responseFromListHealthTip.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListHealthTip.message,
          errors: responseFromListHealthTip.errors
            ? responseFromListHealthTip.errors
            : { message: "" },
        });
      }
    } catch (error) {
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
  create: async (req, res, next) => {
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

      const responseFromCreateHealthTip = await createHealthTipUtil.create(
        request,
        next
      );

      if (responseFromCreateHealthTip.success === true) {
        const status = responseFromCreateHealthTip.status
          ? responseFromCreateHealthTip.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromCreateHealthTip.message,
          created_tip: responseFromCreateHealthTip.data
            ? responseFromCreateHealthTip.data
            : [],
        });
      } else if (responseFromCreateHealthTip.success === false) {
        const status = responseFromCreateHealthTip.status
          ? responseFromCreateHealthTip.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromCreateHealthTip.message,
          errors: responseFromCreateHealthTip.errors
            ? responseFromCreateHealthTip.errors
            : { message: "" },
        });
      }
    } catch (error) {
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

      const responseFromDeleteHealthTip = await createHealthTipUtil.delete(
        request,
        next
      );

      if (responseFromDeleteHealthTip.success === true) {
        const status = responseFromDeleteHealthTip.status
          ? responseFromDeleteHealthTip.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromDeleteHealthTip.message,
          deleted_tip: responseFromDeleteHealthTip.data,
        });
      } else if (responseFromDeleteHealthTip.success === false) {
        const status = responseFromDeleteHealthTip.status
          ? responseFromDeleteHealthTip.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromDeleteHealthTip.message,
          errors: responseFromDeleteHealthTip.errors
            ? responseFromDeleteHealthTip.errors
            : { message: "" },
        });
      }
    } catch (error) {
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

      const responseFromUpdateHealthTip = await createHealthTipUtil.update(
        request,
        next
      );

      if (responseFromUpdateHealthTip.success === true) {
        const status = responseFromUpdateHealthTip.status
          ? responseFromUpdateHealthTip.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromUpdateHealthTip.message,
          updated_tip: responseFromUpdateHealthTip.data,
        });
      } else if (responseFromUpdateHealthTip.success === false) {
        const status = responseFromUpdateHealthTip.status
          ? responseFromUpdateHealthTip.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromUpdateHealthTip.message,
          errors: responseFromUpdateHealthTip.errors
            ? responseFromUpdateHealthTip.errors
            : { message: "" },
        });
      }
    } catch (error) {
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

module.exports = createHealthTips;
