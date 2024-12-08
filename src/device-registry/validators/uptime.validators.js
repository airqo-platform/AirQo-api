const { body, param, query, validationResult } = require("express-validator");
const moment = require("moment");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const constants = require("@config/constants");

// Middleware to check validation results
const checkValidationResults = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      [err.path]: err.msg,
    }));

    return next(
      new HttpError(
        "Validation failed",
        httpStatus.BAD_REQUEST,
        extractedErrors
      )
    );
  }
  next();
};

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.NETWORKS)
    .withMessage("the tenant value is not among the expected ones"),
]);

// Common date validation function
const validateDateRange = (startDateField, endDateField) => [
  query(startDateField)
    .notEmpty()
    .withMessage(`${startDateField} is required`)
    .custom((value) => {
      // Validate ISO 8601 date format
      if (!moment(value, moment.ISO_8601, true).isValid()) {
        throw new Error(
          `${startDateField} must be a valid ISO 8601 datetime string`
        );
      }
      return true;
    }),

  query(endDateField)
    .notEmpty()
    .withMessage(`${endDateField} is required`)
    .custom((value) => {
      // Validate ISO 8601 date format
      if (!moment(value, moment.ISO_8601, true).isValid()) {
        throw new Error(
          `${endDateField} must be a valid ISO 8601 datetime string`
        );
      }
      return true;
    })
    .custom((value, { req }) => {
      const startDate = moment(req.query[startDateField]);
      const endDate = moment(value);

      // Ensure end date is after start date
      if (endDate.isSameOrBefore(startDate)) {
        throw new Error(`${endDateField} must be after start date`);
      }
      return true;
    }),
];

// Uptime queries validation middleware
const validateUptimeQueries = [
  // Tenant validation
  query("tenant")
    .optional()
    .trim()
    .isString()
    .withMessage("Tenant must be a string"),

  // Date range validation
  ...validateDateRange("startDate", "endDate"),

  // Optional devices query for device uptime
  query("devices")
    .optional()
    .custom((value) => {
      // If provided, ensure it's a comma-separated string or array
      if (typeof value === "string") {
        const devices = value.split(",").map((device) => device.trim());
        if (devices.some((device) => device === "")) {
          throw new Error("Devices list cannot contain empty values");
        }
      }
      return true;
    }),

  // Device name validation
  query("device_name")
    .optional()
    .trim()
    .isString()
    .withMessage("Device name must be a string"),

  // Optional limit validation
  query("limit")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Limit must be a non-negative integer")
    .toInt(),

  // Middleware to check validation results
  checkValidationResults,
];

// Device battery queries validation middleware
const validateDeviceBatteryQueries = [
  // Device name validation
  query("deviceName")
    .notEmpty()
    .withMessage("Device name is required")
    .trim()
    .isString()
    .withMessage("Device name must be a string"),

  // Date range validation
  ...validateDateRange("startDate", "endDate"),

  // Optional minutes average validation
  query("minutesAverage")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Minutes average must be a positive integer")
    .toInt(),

  // Optional rounding validation
  query("rounding")
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage("Rounding must be an integer between 0 and 10")
    .toInt(),

  // Middleware to check validation results
  checkValidationResults,
];

module.exports = {
  validateUptimeQueries,
  validateDeviceBatteryQueries,
  validateTenant,
};
