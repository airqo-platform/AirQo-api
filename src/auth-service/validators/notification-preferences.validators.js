const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

// Common validations
const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],
  preferenceId: [
    param("preference_id")
      .exists()
      .withMessage("preference ID is missing in request")
      .trim()
      .notEmpty()
      .withMessage("preference ID cannot be empty")
      .isMongoId()
      .withMessage("preference ID must be a valid ObjectId")
      .customSanitizer((value) => ObjectId(value)),
  ],
  pagination: (defaultLimit = 20, maxLimit = 100) => {
    return (req, res, next) => {
      const limit = parseInt(req.query.limit, 10);
      const skip = parseInt(req.query.skip, 10);
      req.query.limit =
        Number.isNaN(limit) || limit < 1
          ? defaultLimit
          : Math.min(limit, maxLimit);
      req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
      next();
    };
  },
};

const notificationPreferenceValidations = {
  // List validation
  listValidation: [
    ...commonValidations.tenant,
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Invalid page number"),
    query("limit")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Invalid limit number"),
  ],

  // Create validation
  createValidation: [
    ...commonValidations.tenant,
    body("user_id").isMongoId().withMessage("Invalid user ID"),
    body("notification_type")
      .isIn(["email", "push", "sms"])
      .withMessage("Invalid notification type"),
  ],

  // Update validation
  updateValidation: [
    ...commonValidations.preferenceId,
    body("notification_type")
      .optional()
      .isIn(["email", "push", "sms"])
      .withMessage("Invalid notification type"),
  ],

  // Update thresholds validation
  updateThresholdsValidation: [
    ...commonValidations.preferenceId,
    body("thresholds").isObject().withMessage("Thresholds must be an object"),
  ],

  // Update quiet hours validation
  updateQuietHoursValidation: [
    ...commonValidations.preferenceId,
    body("quiet_hours").isObject().withMessage("Quiet hours must be an object"),
  ],

  // Toggle notification validation
  toggleNotificationValidation: [
    ...commonValidations.preferenceId,
    body("notification_type")
      .isIn(["email", "push", "sms"])
      .withMessage("Invalid notification type"),
  ],

  // History validation
  historyValidation: [
    ...commonValidations.preferenceId,
    ...commonValidations.tenant,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date"),
  ],

  // Stats validation
  statsValidation: [
    ...commonValidations.tenant,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date"),
    query("notification_type")
      .optional()
      .isIn(["email", "push", "sms"])
      .withMessage("Invalid notification type"),
  ],

  // Report validation
  reportValidation: [
    ...commonValidations.tenant,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date"),
    query("report_type")
      .optional()
      .isIn(["summary", "detailed"])
      .withMessage("Invalid report type"),
  ],

  // Bulk update validation
  bulkUpdateValidation: [
    ...commonValidations.tenant,
    body("preferences").isArray().withMessage("preferences must be an array"),
    body("preferences.*.preference_id")
      .isMongoId()
      .withMessage("Invalid preference ID"),
    body("preferences.*.updates")
      .isObject()
      .withMessage("Updates must be an object"),
  ],
};

module.exports = {
  ...notificationPreferenceValidations,
  ...commonValidations,
  pagination: commonValidations.pagination,
};
