const controlAccessUtil = require("@utils/control-access");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- permission-controller`
);

const createPermission = {
  create: async (req, res, next) => {
    try {
      logText("creating permission.....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreatePermission =
        await controlAccessUtil.createPermission(request, next);

      if (responseFromCreatePermission.success === true) {
        const status = responseFromCreatePermission.status
          ? responseFromCreatePermission.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreatePermission.message
            ? responseFromCreatePermission.message
            : "",
          created_permission: responseFromCreatePermission.data
            ? responseFromCreatePermission.data
            : [],
        });
      } else if (responseFromCreatePermission.success === false) {
        const status = responseFromCreatePermission.status
          ? responseFromCreatePermission.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreatePermission.message
            ? responseFromCreatePermission.message
            : "",
          errors: responseFromCreatePermission.errors
            ? responseFromCreatePermission.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      const responseFromListPermissions =
        await controlAccessUtil.listPermission(request, next);

      if (responseFromListPermissions.success === true) {
        const status = responseFromListPermissions.status
          ? responseFromListPermissions.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListPermissions.message
            ? responseFromListPermissions.message
            : "",
          permissions: responseFromListPermissions.data
            ? responseFromListPermissions.data
            : [],
        });
      } else if (responseFromListPermissions.success === false) {
        const status = responseFromListPermissions.status
          ? responseFromListPermissions.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListPermissions.message
            ? responseFromListPermissions.message
            : "",
          errors: responseFromListPermissions.errors
            ? responseFromListPermissions.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromDeletePermission =
        await controlAccessUtil.deletePermission(request, next);

      if (responseFromDeletePermission.success === true) {
        const status = responseFromDeletePermission.status
          ? responseFromDeletePermission.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeletePermission.message
            ? responseFromDeletePermission.message
            : "",
          deleted_permission: responseFromDeletePermission.data
            ? responseFromDeletePermission.data
            : [],
        });
      } else if (responseFromDeletePermission.success === false) {
        const status = responseFromDeletePermission.status
          ? responseFromDeletePermission.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeletePermission.message
            ? responseFromDeletePermission.message
            : "",
          errors: responseFromDeletePermission.errors
            ? responseFromDeletePermission.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdatePermission =
        await controlAccessUtil.updatePermission(request, next);

      if (responseFromUpdatePermission.success === true) {
        const status = responseFromUpdatePermission.status
          ? responseFromUpdatePermission.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdatePermission.message
            ? responseFromUpdatePermission.message
            : "",
          updated_permission: responseFromUpdatePermission.data
            ? responseFromUpdatePermission.data
            : [],
        });
      } else if (responseFromUpdatePermission.success === false) {
        const status = responseFromUpdatePermission.status
          ? responseFromUpdatePermission.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdatePermission.message
            ? responseFromUpdatePermission.message
            : "",
          errors: responseFromUpdatePermission.errors
            ? responseFromUpdatePermission.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

module.exports = createPermission;
