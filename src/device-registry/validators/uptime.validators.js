// uptime.validators.js
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

const commonValidations = {
  errorChecker: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(
        new HttpError(
          "Validation error",
          httpStatus.BAD_REQUEST,
          errors.mapped(),
        ),
      );
    }
    next();
  },
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant cannot be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],
  dateRange: (startDateField, endDateField) => [
    query(startDateField)
      .exists()
      .withMessage(`${startDateField} is required`)
      .notEmpty()
      .withMessage(`${startDateField} cannot be empty`)
      .isISO8601()
      .withMessage(`${startDateField} must be a valid ISO datetime`)
      .toDate(),
    query(endDateField)
      .exists()
      .withMessage(`${endDateField} is required`)
      .notEmpty()
      .withMessage(`${endDateField} cannot be empty`)
      .isISO8601()
      .toDate()
      .withMessage(`${endDateField} must be a valid ISO datetime`)
      .custom((value, { req }) => {
        const startDate = moment(req.query[startDateField]);
        const endDate = moment(value);
        if (endDate.isSameOrBefore(startDate)) {
          throw new Error(`${endDateField} must be after ${startDateField}`);
        }
        return true;
      }),
  ],
  devices: [
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
  ],
  deviceName: [
    query("device_name")
      .optional()
      .trim()
      .isString()
      .withMessage("Device name must be a string"),
  ],
  limit: [
    query("limit")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Limit must be a non-negative integer")
      .toInt(),
  ],
  deviceNameBody: [
    body("deviceName")
      .exists()
      .withMessage("deviceName is required")
      .notEmpty()
      .withMessage("deviceName cannot be empty")
      .trim()
      .isString()
      .withMessage("deviceName must be a string"),
  ],
  minutesAverage: [
    query("minutesAverage")
      .optional()
      .isInt({ min: 1 })
      .withMessage("minutesAverage must be a positive integer")
      .toInt(),
  ],
  rounding: [
    query("rounding")
      .optional()
      .isInt({ min: 0, max: 10 })
      .withMessage("rounding must be an integer between 0 and 10")
      .toInt(),
  ],

  uptimeBody: [
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
  ],
};

const uptimeValidations = {
  pagination: (defaultLimit = 1000, maxLimit = 2000) => {
    // Add pagination here
    return (req, res, next) => {
      let limit = parseInt(req.query.limit, 10);
      const skip = parseInt(req.query.skip, 10);
      if (Number.isNaN(limit) || limit < 1) {
        limit = defaultLimit;
      }
      if (limit > maxLimit) {
        limit = maxLimit;
      }
      if (Number.isNaN(skip) || skip < 0) {
        req.query.skip = 0;
      }
      req.query.limit = limit;
      req.query.skip = skip;
      next();
    };
  },
  getUptime: [
    ...commonValidations.tenant,
    ...commonValidations.dateRange("startDate", "endDate"),
    ...commonValidations.devices,
    ...commonValidations.deviceName,
    ...commonValidations.limit,
    commonValidations.errorChecker,
  ],
  createUptime: [
    ...commonValidations.tenant,
    ...commonValidations.uptimeBody,
    commonValidations.errorChecker,
  ],
  postUptime: [
    ...commonValidations.tenant,
    ...commonValidations.uptimeBody,
    commonValidations.errorChecker,
  ],
  getDeviceBattery: [
    ...commonValidations.tenant,
    ...commonValidations.deviceNameBody,
    ...commonValidations.dateRange("startDate", "endDate"),
    ...commonValidations.minutesAverage,
    ...commonValidations.rounding,
    commonValidations.errorChecker,
  ],
};

module.exports = uptimeValidations;
