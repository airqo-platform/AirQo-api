const { HttpError } = require("@utils/errors");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- notification-preferences-util`
);
const generateFilter = require("@utils/generate-filter");
const { logObject } = require("@utils/log");
const NotificationPreferenceModel = require("@models/NotificationPreference");
// const { validateUser } = require("@utils/validateUser");

// Utility function to handle errors
const handleError = (next, message, status, details) => {
  next(new HttpError(message, status, { message: details }));
  return null;
};

const notificationPreferences = {
  list: async (request, next) => {
    try {
      const {
        query: { tenant, limit, skip },
      } = request;
      const filter = generateFilter.notificationPreferences(request, next);

      const listResponse = await NotificationPreferenceModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return listResponse;
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

  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      logObject("creating notification preferences with body", body);

      // Validate user
      // await validateUser(tenant, body.user_id, next);

      const filterResponse = generateFilter.notificationPreferences(
        request,
        next
      );
      if (isEmpty(filterResponse) || isEmpty(filterResponse.user_id)) {
        return handleError(
          next,
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          "Unable to obtain the user identifier for preferences"
        );
      }

      // Check if preferences already exist for this user
      const existingPreference = await NotificationPreferenceModel(
        tenant
      ).findOne(filterResponse);
      if (existingPreference) {
        return handleError(
          next,
          "Conflict",
          httpStatus.CONFLICT,
          "Notification preferences for this user already exist"
        );
      }

      const response = await NotificationPreferenceModel(tenant).register(
        body,
        next
      );
      logObject("created notification preferences", response);
      return response;
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

  update: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant } = query;
      const { preference_id } = params;

      logObject("updating notification preferences with body", body);

      // Validate user
      // await validateUser(tenant, body.user_id, next);

      // Check if preferences exist
      const existingPreference = await NotificationPreferenceModel(
        tenant
      ).findById(preference_id);
      if (!existingPreference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Notification preferences not found"
        );
      }

      // Update preferences
      const response = await NotificationPreferenceModel(tenant).update(
        preference_id,
        body,
        next
      );
      logObject("updated notification preferences", response);
      return response;
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

  updateThresholds: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant } = query;
      const { preference_id } = params;

      logObject("updating thresholds with body", body);

      const existingPreference = await NotificationPreferenceModel(
        tenant
      ).findById(preference_id);
      if (!existingPreference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Notification preferences not found"
        );
      }

      // Validate thresholds format
      if (!Array.isArray(body.thresholds)) {
        return handleError(
          next,
          "Bad Request",
          httpStatus.BAD_REQUEST,
          "Thresholds must be an array"
        );
      }

      const response = await NotificationPreferenceModel(
        tenant
      ).updateThresholds(preference_id, body.thresholds, next);
      logObject("updated thresholds", response);
      return response;
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

  updateQuietHours: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant } = query;
      const { preference_id } = params;

      logObject("updating quiet hours with body", body);

      const existingPreference = await NotificationPreferenceModel(
        tenant
      ).findById(preference_id);
      if (!existingPreference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Notification preferences not found"
        );
      }

      // Validate quiet hours format
      if (!body.quiet_hours || typeof body.quiet_hours.enabled !== "boolean") {
        return handleError(
          next,
          "Bad Request",
          httpStatus.BAD_REQUEST,
          "Invalid quiet hours format"
        );
      }

      const response = await NotificationPreferenceModel(
        tenant
      ).updateQuietHours(preference_id, body.quiet_hours, next);
      logObject("updated quiet hours", response);
      return response;
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

  delete: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const { preference_id } = params;

      const existingPreference = await NotificationPreferenceModel(
        tenant
      ).findById(preference_id);
      if (!existingPreference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Notification preferences not found"
        );
      }

      const response = await NotificationPreferenceModel(tenant).delete(
        preference_id,
        next
      );
      logObject("deleted notification preferences", response);
      return response;
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

  getById: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const { preference_id } = params;

      const preference = await NotificationPreferenceModel(tenant).findById(
        preference_id
      );
      if (!preference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Notification preferences not found"
        );
      }

      return preference;
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

  toggleNotificationType: async (request, next) => {
    try {
      const { body, query, params } = request;
      const { tenant } = query;
      const { preference_id } = params;
      const { notification_type, enabled } = body;

      if (!["email", "push", "sms"].includes(notification_type)) {
        return handleError(
          next,
          "Bad Request",
          httpStatus.BAD_REQUEST,
          "Invalid notification type"
        );
      }

      const existingPreference = await NotificationPreferenceModel(
        tenant
      ).findById(preference_id);
      if (!existingPreference) {
        return handleError(
          next,
          "Not Found",
          httpStatus.NOT_FOUND,
          "Notification preferences not found"
        );
      }

      const response = await NotificationPreferenceModel(
        tenant
      ).toggleNotificationType(preference_id, notification_type, enabled, next);
      logObject("toggled notification type", response);
      return response;
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

  getNotificationHistory: async (request, next) => {
    try {
      const {
        query: { tenant, start_date, end_date },
        params: { preference_id },
      } = request;

      const filter = {
        preference_id: ObjectId(preference_id),
        ...(start_date &&
          end_date && {
            created_at: {
              $gte: new Date(start_date),
              $lte: new Date(end_date),
            },
          }),
      };

      const history = await NotificationHistoryModel(tenant)
        .find(filter)
        .sort({ created_at: -1 })
        .lean();

      return {
        success: true,
        status: httpStatus.OK,
        message: "Notification history retrieved successfully",
        data: history,
      };
    } catch (error) {
      logger.error(`Error getting notification history: ${error.message}`);
      return handleError(
        next,
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  },

  // Get notification statistics
  getNotificationStats: async (request, next) => {
    try {
      const {
        query: { tenant, start_date, end_date, notification_type },
      } = request;

      const matchStage = {
        ...(start_date &&
          end_date && {
            created_at: {
              $gte: new Date(start_date),
              $lte: new Date(end_date),
            },
          }),
        ...(notification_type && { notification_type }),
      };

      const stats = await NotificationModel(tenant).aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]);

      return {
        success: true,
        status: httpStatus.OK,
        message: "Notification statistics retrieved successfully",
        data: stats,
      };
    } catch (error) {
      logger.error(`Error getting notification stats: ${error.message}`);
      return handleError(
        next,
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  },

  // Generate notification report
  generateNotificationReport: async (request, next) => {
    try {
      const {
        query: { tenant, start_date, end_date, report_type = "summary" },
      } = request;

      const matchStage = {
        ...(start_date &&
          end_date && {
            created_at: {
              $gte: new Date(start_date),
              $lte: new Date(end_date),
            },
          }),
      };

      let pipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              type: "$notification_type",
              status: "$status",
            },
            count: { $sum: 1 },
          },
        },
      ];

      if (report_type === "detailed") {
        pipeline = [
          { $match: matchStage },
          {
            $lookup: {
              from: "users",
              localField: "user_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          {
            $project: {
              notification_type: 1,
              status: 1,
              created_at: 1,
              "user.name": 1,
              "user.email": 1,
            },
          },
        ];
      }

      const report = await NotificationModel(tenant).aggregate(pipeline);

      return {
        success: true,
        status: httpStatus.OK,
        message: "Notification report generated successfully",
        data: report,
      };
    } catch (error) {
      logger.error(`Error generating notification report: ${error.message}`);
      return handleError(
        next,
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  },

  // Bulk update preferences
  bulkUpdate: async (request, next) => {
    try {
      const {
        query: { tenant },
        body: { preferences },
      } = request;

      const updatePromises = preferences.map(
        async ({ preference_id, updates }) => {
          try {
            const updatedPreference = await NotificationPreferenceModel(
              tenant
            ).findByIdAndUpdate(preference_id, updates, { new: true });
            return {
              preference_id,
              success: true,
              data: updatedPreference,
            };
          } catch (error) {
            return {
              preference_id,
              success: false,
              error: error.message,
            };
          }
        }
      );

      const results = await Promise.all(updatePromises);

      return {
        success: true,
        status: httpStatus.OK,
        message: "Bulk update completed",
        data: results,
      };
    } catch (error) {
      logger.error(`Error in bulk update: ${error.message}`);
      return handleError(
        next,
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        error.message
      );
    }
  },
};

module.exports = notificationPreferences;
