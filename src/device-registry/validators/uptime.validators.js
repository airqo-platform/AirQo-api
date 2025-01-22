const {
  body,
  param,
  query,
  validationResult,
  oneOf,
} = require("express-validator");
const moment = require("moment");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const constants = require("@config/constants");

// Enhanced error handling with structured response
const checkValidationResults = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMap = {};
    errors.array().forEach((err) => {
      errorMap[err.path] = err.msg;
    });

    return next(
      new HttpError(
        "Some errors occurred while processing this request",
        httpStatus.BAD_REQUEST,
        { errors: errorMap }
      )
    );
  }
  next();
};

// Enhanced tenant validation
const validateTenant = [
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(constants.NETWORKS)
    .withMessage("the tenant value is not among the expected ones"),
  checkValidationResults,
];

// Improved date validation with ISO format check
const validateDateRange = (startDateField, endDateField) => [
  query(startDateField)
    .exists()
    .withMessage(`${startDateField} is required`)
    .notEmpty()
    .withMessage(`${startDateField} cannot be empty`)
    .custom((value) => {
      if (!moment(value, moment.ISO_8601, true).isValid()) {
        throw new Error(
          `Please provide a valid ISO formatted datetime string (YYYY-MM-DDTHH:mm:ss.sssZ)`
        );
      }
      return true;
    }),

  query(endDateField)
    .exists()
    .withMessage(`${endDateField} is required`)
    .notEmpty()
    .withMessage(`${endDateField} cannot be empty`)
    .custom((value) => {
      if (!moment(value, moment.ISO_8601, true).isValid()) {
        throw new Error(
          `Please provide a valid ISO formatted datetime string (YYYY-MM-DDTHH:mm:ss.sssZ)`
        );
      }
      return true;
    })
    .custom((value, { req }) => {
      const startDate = moment(req.query[startDateField]);
      const endDate = moment(value);
      if (endDate.isSameOrBefore(startDate)) {
        throw new Error(`${endDateField} must be after ${startDateField}`);
      }
      return true;
    }),
];

// Enhanced uptime queries validation
const validateUptimeQueries = [
  ...validateDateRange("startDate", "endDate"),

  query("devices")
    .optional()
    .custom((value) => {
      if (value) {
        const devices = Array.isArray(value) ? value : value.split(",");
        if (devices.some((device) => !device.trim())) {
          throw new Error("Devices list cannot contain empty values");
        }
      }
      return true;
    }),

  query("device_name")
    .optional()
    .trim()
    .isString()
    .withMessage("Device name must be a string"),

  query("limit")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Limit must be a non-negative integer")
    .toInt(),

  checkValidationResults,
];

// New POST request body validation for uptime
const validateUptimeBody = [
  body("startDateTime")
    .exists()
    .withMessage("startDateTime is required")
    .isISO8601()
    .withMessage("startDateTime must be a valid ISO datetime"),

  body("endDateTime")
    .exists()
    .withMessage("endDateTime is required")
    .isISO8601()
    .withMessage("endDateTime must be a valid ISO datetime")
    .custom((value, { req }) => {
      if (moment(value).isSameOrBefore(req.body.startDateTime)) {
        throw new Error("endDateTime must be after startDateTime");
      }
      return true;
    }),

  body("airqloud")
    .optional()
    .isString(),
  body("cohort")
    .optional()
    .isString(),
  body("grid")
    .optional()
    .isString(),
  body("threshold")
    .optional()
    .isInt(),
  body("site")
    .optional()
    .isString(),
  body("devices")
    .optional()
    .isArray(),

  checkValidationResults,
];

// Enhanced device battery queries validation
const validateDeviceBatteryQueries = [
  query("deviceName")
    .exists()
    .withMessage("deviceName is required")
    .notEmpty()
    .withMessage("deviceName cannot be empty")
    .trim()
    .isString()
    .withMessage("deviceName must be a string"),

  ...validateDateRange("startDate", "endDate"),

  query("minutesAverage")
    .optional()
    .isInt({ min: 1 })
    .withMessage("minutesAverage must be a positive integer")
    .toInt(),

  query("rounding")
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage("rounding must be an integer between 0 and 10")
    .toInt(),

  checkValidationResults,
];

module.exports = {
  validateUptimeQueries,
  validateDeviceBatteryQueries,
  validateTenant,
  validateUptimeBody,
};
