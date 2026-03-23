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
  deviceId: [
    param("deviceId")
      .exists()
      .withMessage("the device identifier is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("deviceId must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
  siteId: [
    param("siteId")
      .exists()
      .withMessage("the site identifier is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("siteId must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
};

const validateForecastValue = {
  time: [
    body("values.*.time")
      .exists()
      .withMessage("time is required for each forecast value")
      .bail()
      .isISO8601()
      .withMessage("time must be a valid ISO 8601 date"),
  ],
  forecast_horizon: [
    body("values.*.forecast_horizon")
      .exists()
      .withMessage("forecast_horizon is required for each forecast value")
      .bail()
      .isInt({ min: 0 })
      .withMessage("forecast_horizon must be a non-negative integer"),
  ],
  pm2_5: [
    body("values.*.pm2_5.value")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("pm2_5 value must be a non-negative number"),
    body("values.*.pm2_5.confidence_lower")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("pm2_5 confidence_lower must be a non-negative number"),
    body("values.*.pm2_5.confidence_upper")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("pm2_5 confidence_upper must be a non-negative number")
      .custom((value, { req }) => {
        const valueIndex = req.body.values.findIndex(
          (v) => v.pm2_5.confidence_upper === value,
        );
        const lower = req.body.values[valueIndex].pm2_5.confidence_lower;
        if (lower && value <= lower) {
          throw new Error(
            "confidence_upper must be greater than confidence_lower",
          );
        }
        return true;
      }),
  ],
  pm10: [
    body("values.*.pm10.value")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("pm10 value must be a non-negative number"),
    body("values.*.pm10.confidence_lower")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("pm10 confidence_lower must be a non-negative number"),
    body("values.*.pm10.confidence_upper")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("pm10 confidence_upper must be a non-negative number")
      .custom((value, { req }) => {
        const valueIndex = req.body.values.findIndex(
          (v) => v.pm10.confidence_upper === value,
        );
        const lower = req.body.values[valueIndex].pm10.confidence_lower;
        if (lower && value <= lower) {
          throw new Error(
            "confidence_upper must be greater than confidence_lower",
          );
        }
        return true;
      }),
  ],
};

const forecastValidations = {
  pagination: (defaultLimit = 1000, maxLimit = 2000) => {
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
  create: [
    ...commonValidations.tenant,
    body("device_id")
      .exists()
      .withMessage("device_id is required")
      .bail()
      .isMongoId()
      .withMessage("device_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("site_id")
      .exists()
      .withMessage("site_id is required")
      .bail()
      .isMongoId()
      .withMessage("site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("forecast_created_at")
      .exists()
      .withMessage("forecast_created_at is required")
      .bail()
      .isISO8601()
      .withMessage("forecast_created_at must be a valid ISO 8601 date"),
    body("model_version")
      .exists()
      .withMessage("model_version is required")
      .bail()
      .trim()
      .matches(/^v\d+\.\d+\.\d+$/)
      .withMessage("model_version must be in format vX.Y.Z"),
    body("values")
      .exists()
      .withMessage("values array is required")
      .bail()
      .isArray()
      .withMessage("values must be an array")
      .bail()
      .notEmpty()
      .withMessage("values array cannot be empty"),
    ...validateForecastValue.time,
    ...validateForecastValue.forecast_horizon,
    ...validateForecastValue.pm2_5,
    ...validateForecastValue.pm10,
  ],
  listByDevice: [
    ...commonValidations.tenant,
    ...commonValidations.deviceId,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (req.query.start_date && value <= req.query.start_date) {
          throw new Error("end_date must be after start_date");
        }
        return true;
      }),
  ],
  listBySite: [
    ...commonValidations.tenant,
    ...commonValidations.siteId,
    query("start_date")
      .optional()
      .isISO8601()
      .withMessage("start_date must be a valid ISO 8601 date"),
    query("end_date")
      .optional()
      .isISO8601()
      .withMessage("end_date must be a valid ISO 8601 date")
      .custom((value, { req }) => {
        if (req.query.start_date && value <= req.query.start_date) {
          throw new Error("end_date must be after start_date");
        }
        return true;
      }),
  ],
};

module.exports = forecastValidations;
