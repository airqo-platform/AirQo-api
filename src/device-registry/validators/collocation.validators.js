const { body, query, validationResult } = require("express-validator");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const CollocationBatchModel = require("@models/CollocationBatch");

const validateErrorMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
        errors: errors.array(),
      })
    );
  }
  next();
};

const validateCollocationBatch = [
  body("startDate")
    .exists()
    .withMessage("Start date is required")
    .isISO8601()
    .withMessage("Start date must be a valid date"),

  body("endDate")
    .exists()
    .withMessage("End date is required")
    .isISO8601()
    .withMessage("End date must be a valid date")
    .custom((endDate, { req }) => {
      const startDate = req.body.startDate;
      if (new Date(endDate) < new Date(startDate)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  body("devices")
    .exists()
    .withMessage("Devices are required")
    .isArray()
    .withMessage("Devices must be an array")
    .custom((devices) => {
      if (devices.length < 2) {
        throw new Error("At least two devices are required for collocation");
      }
      return true;
    }),

  body("batchName")
    .optional()
    .isString()
    .withMessage("Batch name must be a string")
    .isLength({ max: 100 })
    .withMessage("Batch name must be less than 100 characters"),

  body("baseDevice")
    .optional()
    .isString()
    .withMessage("Base device must be a string"),

  body("expectedRecordsPerHour")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Expected records per hour must be a positive integer")
    .toInt(),

  body("dataCompletenessThreshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Data completeness threshold must be between 0 and 1")
    .toFloat(),

  body("intraCorrelationThreshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Intra correlation threshold must be between 0 and 1")
    .toFloat(),

  body("interCorrelationThreshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Inter correlation threshold must be between 0 and 1")
    .toFloat(),

  body("intraCorrelationR2Threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Intra correlation R2 threshold must be between 0 and 1")
    .toFloat(),

  body("interCorrelationR2Threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Inter correlation R2 threshold must be between 0 and 1")
    .toFloat(),

  body("differencesThreshold")
    .optional()
    .isFloat()
    .withMessage("Differences threshold must be a number")
    .toFloat(),

  body("interCorrelationParameter")
    .optional()
    .isString()
    .withMessage("Inter correlation parameter must be a string"),

  body("intraCorrelationParameter")
    .optional()
    .isString()
    .withMessage("Intra correlation parameter must be a string"),

  body("dataCompletenessParameter")
    .optional()
    .isString()
    .withMessage("Data completeness parameter must be a string"),

  body("differencesParameter")
    .optional()
    .isString()
    .withMessage("Differences parameter must be a string"),

  body("interCorrelationAdditionalParameters")
    .optional()
    .isArray()
    .withMessage("Inter correlation additional parameters must be an array"),

  validateErrorMiddleware,
];

const validateCollocationParams = [
  query("batchId")
    .exists()
    .withMessage("Batch ID is required")
    .isString()
    .withMessage("Batch ID must be a string"),

  query("devices")
    .optional()
    .custom((devices) => {
      // If devices are provided, they should be a comma-separated string
      if (devices && typeof devices === "string") {
        const deviceList = devices
          .split(",")
          .filter((device) => device.trim() !== "");
        if (deviceList.length === 0) {
          throw new Error("Devices list cannot be empty");
        }
      }
      return true;
    }),

  validateErrorMiddleware,
];

const validateCollocationReset = [
  body("expectedRecordsPerHour")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Expected records per hour must be a positive integer")
    .toInt(),

  body("dataCompletenessThreshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Data completeness threshold must be between 0 and 1")
    .toFloat(),

  body("intraCorrelationThreshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Intra correlation threshold must be between 0 and 1")
    .toFloat(),

  body("interCorrelationThreshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Inter correlation threshold must be between 0 and 1")
    .toFloat(),

  body("intraCorrelationR2Threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Intra correlation R2 threshold must be between 0 and 1")
    .toFloat(),

  body("interCorrelationR2Threshold")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Inter correlation R2 threshold must be between 0 and 1")
    .toFloat(),

  body("differencesThreshold")
    .optional()
    .isFloat()
    .withMessage("Differences threshold must be a number")
    .toFloat(),

  body("interCorrelationParameter")
    .optional()
    .isString()
    .withMessage("Inter correlation parameter must be a string"),

  body("intraCorrelationParameter")
    .optional()
    .isString()
    .withMessage("Intra correlation parameter must be a string"),

  body("dataCompletenessParameter")
    .optional()
    .isString()
    .withMessage("Data completeness parameter must be a string"),

  body("differencesParameter")
    .optional()
    .isString()
    .withMessage("Differences parameter must be a string"),

  body("interCorrelationAdditionalParameters")
    .optional()
    .isArray()
    .withMessage("Inter correlation additional parameters must be an array"),

  validateErrorMiddleware,
];

module.exports = {
  validateCollocationBatch,
  validateCollocationParams,
  validateCollocationReset,
};
