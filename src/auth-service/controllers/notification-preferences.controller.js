const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const constants = require("@config/constants");
const { isEmpty } = require("lodash");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- notification-preferences-controller`
);
const notificationPreferencesUtil = require("@utils/notification-preferences.util");

const notificationPreferences = {
  // List Notification Preferences
  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.list(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: result.message,
          preferences: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Create Notification Preferences
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

      const result = await notificationPreferencesUtil.create(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.CREATED;
        return res.status(status).json({
          success: true,
          message: "Notification preferences created successfully",
          preference: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message ? result.message : "",
          errors: result.errors
            ? result.errors
            : { message: "Notification preferences creation failed" },
        });
      }
    } catch (error) {
      logObject("error", error);
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

  // Update Notification Preferences
  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.update(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Notification preferences updated successfully",
          preference: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Update Thresholds
  updateThresholds: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.updateThresholds(
        req,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Thresholds updated successfully",
          preference: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Update Quiet Hours
  updateQuietHours: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.updateQuietHours(
        req,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Quiet hours updated successfully",
          preference: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Delete Notification Preferences
  delete: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.delete(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Notification preferences deleted successfully",
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Get By ID
  getById: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.getById(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Notification preferences retrieved successfully",
          preference: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Toggle Notification Type
  toggleNotificationType: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.toggleNotificationType(
        req,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Notification type toggled successfully",
          preference: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Get Notification History
  getNotificationHistory: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.getNotificationHistory(
        req,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Notification history retrieved successfully",
          history: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Get Notification Stats
  getNotificationStats: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.getNotificationStats(
        req,
        next
      );

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Notification statistics retrieved successfully",
          stats: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Generate Notification Report
  generateNotificationReport: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result =
        await notificationPreferencesUtil.generateNotificationReport(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Notification report generated successfully",
          report: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

  // Bulk Update
  bulkUpdate: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = await notificationPreferencesUtil.bulkUpdate(req, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        return res.status(result.status).json({
          success: true,
          message: "Bulk update completed successfully",
          results: result.data,
        });
      } else if (result.success === false) {
        return res.status(result.status).json({
          success: false,
          message: result.message,
          errors: result.errors,
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

module.exports = notificationPreferences;
