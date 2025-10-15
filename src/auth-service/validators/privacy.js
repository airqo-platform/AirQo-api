const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");

const validateCreatePrivacyZone = [
  body("name").exists().withMessage("name is missing").trim(),
  body("latitude")
    .exists()
    .withMessage("latitude is missing")
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be a valid number between -90 and 90"),
  body("longitude")
    .exists()
    .withMessage("longitude is missing")
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be a valid number between -180 and 180"),
  body("radius")
    .exists()
    .withMessage("radius is missing")
    .isFloat({ min: 1 })
    .withMessage("radius must be a number greater than 0"),
];

const validateUpdatePrivacyZone = [
  param("zoneId")
    .exists()
    .withMessage("zoneId is missing in the path")
    .isMongoId()
    .withMessage("zoneId must be a valid Mongo ID"),
  // Optional body fields
  body("name").optional().trim(),
  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("latitude must be a valid number between -90 and 90"),
  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("longitude must be a valid number between -180 and 180"),
  body("radius")
    .optional()
    .isFloat({ min: 1 })
    .withMessage("radius must be a number greater than 0"),
];

const validateListLocationData = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("limit must be an integer between 1 and 1000"),
  query("offset")
    .optional()
    .isInt({ min: 0 })
    .withMessage("offset must be a non-negative integer"),
  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("startDate must be a valid ISO8601 date"),
  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("endDate must be a valid ISO8601 date"),
  query("includeSharedOnly")
    .optional()
    .isBoolean()
    .withMessage("includeSharedOnly must be a boolean value"),
];

const validateDeleteLocationPoint = [
  param("pointId")
    .exists()
    .withMessage("pointId is missing in the path")
    .isMongoId()
    .withMessage("pointId must be a valid Mongo ID"),
];

const validateDeleteLocationDataRange = [
  body("startDate")
    .exists()
    .withMessage("startDate is required")
    .isISO8601()
    .withMessage("startDate must be a valid ISO8601 date"),
  body("endDate")
    .exists()
    .withMessage("endDate is required")
    .isISO8601()
    .withMessage("endDate must be a valid ISO8601 date"),
];

module.exports = {
  validateCreatePrivacyZone,
  validateUpdatePrivacyZone,
  validateListLocationData,
  validateDeleteLocationPoint,
  validateDeleteLocationDataRange,
};
