const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/log");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-activity-controller`
);
const createActivityUtil = require("@utils/create-activity");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");

const activity = {
  deploy: async (req, res, next) => {
    try {
      logText("we are deploying....");
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

      const responseFromDeployDevice = await createActivityUtil.deploy(
        request,
        next
      );
      if (responseFromDeployDevice.success === true) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeployDevice.message,
          createdActivity: responseFromDeployDevice.data.createdActivity,
          updatedDevice: responseFromDeployDevice.data.updatedDevice,
        });
      } else if (responseFromDeployDevice.success === false) {
        const status = responseFromDeployDevice.status
          ? responseFromDeployDevice.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeployDevice.message,
          errors: responseFromDeployDevice.errors
            ? responseFromDeployDevice.errors
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
  recall: async (req, res, next) => {
    try {
      logText("we are recalling....");
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

      const responseFromRecallDevice = await createActivityUtil.recall(
        request,
        next
      );
      if (responseFromRecallDevice.success === true) {
        const status = responseFromRecallDevice.status
          ? responseFromRecallDevice.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRecallDevice.message,
          createdActivity: responseFromRecallDevice.data.createdActivity,
          updatedDevice: responseFromRecallDevice.data.updatedDevice,
        });
      } else if (responseFromRecallDevice.success === false) {
        const status = responseFromRecallDevice.status
          ? responseFromRecallDevice.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRecallDevice.message,
          errors: responseFromRecallDevice.errors
            ? responseFromRecallDevice.errors
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
  maintain: async (req, res, next) => {
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

      const responseFromMaintainDevice = await createActivityUtil.maintain(
        request,
        next
      );
      if (responseFromMaintainDevice.success === true) {
        const status = responseFromMaintainDevice.status
          ? responseFromMaintainDevice.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromMaintainDevice.message,
          createdActivity: responseFromMaintainDevice.data.createdActivity,
          updatedDevice: responseFromMaintainDevice.data.updatedDevice,
        });
      } else if (responseFromMaintainDevice.success === false) {
        const status = responseFromMaintainDevice.status
          ? responseFromMaintainDevice.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromMaintainDevice.message,
          errors: responseFromMaintainDevice.errors
            ? responseFromMaintainDevice.errors
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
  bulkAdd: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      logText("adding activities................");
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
  bulkUpdate: async (req, res, next) => {
    try {
      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: false,
        message: "NOT YET IMPLEMENTED",
        errors: { message: "NOT YET IMPLEMENTED" },
      });
      logText("updating activity................");
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
      logText("updating activity................");
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

      const responseFromUpdateActivity = await createActivityUtil.update(
        request,
        next
      );
      logObject("responseFromUpdateActivity", responseFromUpdateActivity);
      if (responseFromUpdateActivity.success === true) {
        const status = responseFromUpdateActivity.status
          ? responseFromUpdateActivity.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateActivity.message,
          updated_activity: responseFromUpdateActivity.data,
        });
      } else if (responseFromUpdateActivity.success === false) {
        const status = responseFromUpdateActivity.status
          ? responseFromUpdateActivity.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateActivity.message,
          errors: responseFromUpdateActivity.errors
            ? responseFromUpdateActivity.errors
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
      logText(".................................................");
      logText("inside delete activity............");
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

      const responseFromRemoveActivity = await createActivityUtil.delete(
        request,
        next
      );

      if (responseFromRemoveActivity.success === true) {
        const status = responseFromRemoveActivity.status
          ? responseFromRemoveActivity.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveActivity.message,
          deleted_activity: responseFromRemoveActivity.data,
        });
      } else if (responseFromRemoveActivity.success === false) {
        const status = responseFromRemoveActivity.status
          ? responseFromRemoveActivity.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveActivity.message,
          errors: responseFromRemoveActivity.errors
            ? responseFromRemoveActivity.errors
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
  list: async (req, res, next) => {
    try {
      logText(".....................................");
      logText("list all activities by query params provided");
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

      const responseFromListActivities = await createActivityUtil.list(
        request,
        next
      );

      if (responseFromListActivities.success === true) {
        const status = responseFromListActivities.status
          ? responseFromListActivities.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListActivities.message,
          site_activities: responseFromListActivities.data,
        });
      } else if (responseFromListActivities.success === false) {
        const status = responseFromListActivities.status
          ? responseFromListActivities.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListActivities.message,
          errors: responseFromListActivities.errors
            ? responseFromListActivities.errors
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

module.exports = activity;
