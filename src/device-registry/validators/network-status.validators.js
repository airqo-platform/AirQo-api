const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const isEmpty = require("is-empty");

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("the tenant cannot be empty, if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],
};

const networkStatusValidations = {
  create: [
    ...commonValidations.tenant,
    body("checked_at")
      .exists()
      .withMessage("checked_at is required")
      .bail()
      .isISO8601()
      .withMessage("checked_at must be a valid ISO 8601 date"),
    body("total_deployed_devices")
      .exists()
      .withMessage("total_deployed_devices is required")
      .bail()
      .isInt({ min: 0 })
      .withMessage("total_deployed_devices must be a non-negative integer"),
    body("offline_devices_count")
      .exists()
      .withMessage("offline_devices_count is required")
      .bail()
      .isInt({ min: 0 })
      .withMessage("offline_devices_count must be a non-negative integer")
      .custom((value, { req }) => {
        if (value > req.body.total_deployed_devices) {
          throw new Error(
            "offline_devices_count cannot exceed total_deployed_devices",
          );
        }
        return true;
      }),
    body("offline_percentage")
      .exists()
      .withMessage("offline_percentage is required")
      .bail()
      .isFloat({ min: 0, max: 100 })
      .withMessage("offline_percentage must be between 0 and 100"),
    body("status")
      .exists()
      .withMessage("status is required")
      .bail()
      .isIn(["OK", "WARNING", "CRITICAL"])
      .withMessage("status must be one of: OK, WARNING, CRITICAL"),
    body("message")
      .exists()
      .withMessage("message is required")
      .bail()
      .isString()
      .withMessage("message must be a string")
      .trim()
      .notEmpty()
      .withMessage("message cannot be empty"),
    body("threshold_exceeded")
      .exists()
      .withMessage("threshold_exceeded is required")
      .bail()
      .isBoolean()
      .withMessage("threshold_exceeded must be a boolean"),
    body("threshold_value")
      .exists()
      .withMessage("threshold_value is required")
      .bail()
      .isFloat({ min: 0, max: 100 })
      .withMessage("threshold_value must be between 0 and 100"),
    body("alert_type")
      .optional()
      .isString()
      .withMessage("alert_type must be a string")
      .trim(),
  ],

  list: [
    ...commonValidations.tenant,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (
          req.query.start_date &&
          new Date(value) <= new Date(req.query.start_date)
        ) {
          throw new Error("end_date must be after start_date");
        }
        return true;
      }),
    query("status")
      .optional()
      .isIn(["OK", "WARNING", "CRITICAL"])
      .withMessage("status must be one of: OK, WARNING, CRITICAL"),
    query("threshold_exceeded")
      .optional()
      .isIn(["true", "false"])
      .withMessage("threshold_exceeded must be 'true' or 'false'"),
  ],

  getStatistics: [
    ...commonValidations.tenant,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (
          req.query.start_date &&
          new Date(value) <= new Date(req.query.start_date)
        ) {
          throw new Error("end_date must be after start_date");
        }
        return true;
      }),
  ],

  getHourlyTrends: [
    ...commonValidations.tenant,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (
          req.query.start_date &&
          new Date(value) <= new Date(req.query.start_date)
        ) {
          throw new Error("end_date must be after start_date");
        }
        return true;
      }),
  ],

  getRecentAlerts: [
    ...commonValidations.tenant,
    query("hours")
      .optional()
      .isInt({ min: 1, max: 168 }) // Max 1 week
      .withMessage("hours must be between 1 and 168")
      .toInt(),
  ],

  getUptimeSummary: [
    ...commonValidations.tenant,
    query("days")
      .optional()
      .isInt({ min: 1, max: 90 }) // Max 3 months
      .withMessage("days must be between 1 and 90")
      .toInt(),
  ],
};

module.exports = networkStatusValidations;
