const { body, oneOf, query } = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const { isMongoId } = require("validator");
const { logText } = require("@utils/log");
const isEmpty = require("is-empty");

const validateRequestBody = () => {
  return oneOf([
    [
      body("user_id")
        .exists()
        .withMessage("the user_id should be provided in the request body")
        .bail()
        .notEmpty()
        .withMessage("the provided user_id should not be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => ObjectId(value)),
      body("pollutant")
        .optional()
        .notEmpty()
        .withMessage("the provided pollutant should not be empty IF provided")
        .bail()
        .trim()
        .isIn(["no2", "pm2_5", "pm10", "pm1"])
        .withMessage(
          "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1"
        ),
      body("frequency")
        .optional()
        .notEmpty()
        .withMessage("the provided frequency should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["daily", "hourly", "monthly"])
        .withMessage(
          "the frequency value is not among the expected ones which include: daily, hourly and monthly"
        ),
      body("chartType")
        .optional()
        .notEmpty()
        .withMessage("the provided chartType should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["bar", "line", "pie"])
        .withMessage(
          "the chartType value is not among the expected ones which include: bar, line and pie"
        ),
      body("startDate")
        .optional()
        .notEmpty()
        .withMessage("the provided startDate should not be empty IF provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startDate must be a valid datetime."),
      body("endDate")
        .optional()
        .notEmpty()
        .withMessage("the provided endDate should not be empty IF provided")
        .bail()
        .trim()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endDate must be a valid datetime."),
      body("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => ObjectId(value)),
      body("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => ObjectId(value)),
      body("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => ObjectId(value)),
      body("chartTitle")
        .optional()
        .notEmpty()
        .withMessage("the provided chartTitle should not be empty IF provided")
        .bail()
        .trim(),
      body("period")
        .optional()
        .notEmpty()
        .withMessage("the provided period should not be empty IF provided")
        .bail()
        .custom((value) => typeof value === "object")
        .withMessage("the period should be an object"),
      body("chartSubTitle")
        .optional()
        .notEmpty()
        .withMessage(
          "the provided chartSubTitle should not be empty IF provided"
        )
        .bail()
        .trim(),
      body("site_ids")
        .optional()
        .notEmpty()
        .withMessage("the provided site_ids should not be empty IF provided")
        .bail()
        .custom((value) => Array.isArray(value))
        .withMessage("the site_ids should be an array"),
      body("site_ids.*")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID"),
      body("device_ids")
        .optional()
        .notEmpty()
        .withMessage("the provided device_ids should not be empty IF provided")
        .bail()
        .custom((value) => Array.isArray(value))
        .withMessage("the device_ids should be an array"),
      body("device_ids.*")
        .optional()
        .notEmpty()
        .withMessage("the provided device_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("device_id must be an object ID"),
      query("id")
        .optional()
        .notEmpty()
        .withMessage("the provided id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("user_id")
        .optional()
        .notEmpty()
        .withMessage("the provided user_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("airqloud_id")
        .optional()
        .notEmpty()
        .withMessage("the provided airqloud_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the airqloud_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("cohort_id")
        .optional()
        .notEmpty()
        .withMessage("the provided cohort_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the cohort_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("grid_id")
        .optional()
        .notEmpty()
        .withMessage("the provided grid_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("the provided site_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]);
};

module.exports = validateRequestBody;
