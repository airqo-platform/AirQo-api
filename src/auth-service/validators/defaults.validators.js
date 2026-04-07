// defaults.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const validateIdOrUserId = oneOf([
  query("id")
    .exists()
    .withMessage(
      "the record's identifier is missing in request, consider using the id",
    )
    .bail()
    .trim()
    .isMongoId()
    .withMessage("id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  query("user_id")
    .exists()
    .withMessage(
      "the record's identifier is missing in request, consider using the user_id",
    )
    .bail()
    .trim()
    .isMongoId()
    .withMessage("user_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const update = [
  validateTenant,
  validateIdOrUserId,
  [
    body("pollutant")
      .optional()
      .notEmpty()
      .withMessage("the provided pollutant should not be empty IF provided")
      .bail()
      .trim()
      .isIn(["no2", "pm2_5", "pm10", "pm1"])
      .withMessage(
        "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1",
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
        "the frequency value is not among the expected ones which include: daily, hourly and monthly",
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
        "the chartType value is not among the expected ones which include: bar, line and pie",
      ),
    body("startDate")
      .optional()
      .notEmpty()
      .withMessage("the provided startDate should not be empty IF provided")
      .bail()
      .trim()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("startDate must be a valid datetime."),
    body("endDate")
      .optional()
      .notEmpty()
      .withMessage("the provided endDate should not be empty IF provided")
      .bail()
      .trim()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("endDate must be a valid datetime."),
    body("user")
      .optional()
      .notEmpty()
      .withMessage("the provided user should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("airqloud")
      .optional()
      .notEmpty()
      .withMessage("the provided airqloud should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the airqloud must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
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
      .custom((value) => {
        return typeof value === "object";
      })
      .withMessage("the period should be an object"),
    body("chartSubTitle")
      .optional()
      .notEmpty()
      .withMessage("the provided chartSubTitle should not be empty IF provided")
      .bail()
      .trim(),
    body("sites")
      .optional()
      .notEmpty()
      .withMessage("the provided sites should not be empty IF provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the sites should be an array"),
    body("sites.*")
      .optional()
      .notEmpty()
      .withMessage("the provided site should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("site must be an object ID"),
    body("devices")
      .optional()
      .notEmpty()
      .withMessage("the provided devices should not be empty IF provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the devices should be an array"),
    body("devices.*")
      .optional()
      .notEmpty()
      .withMessage("the provided device should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("device must be an object ID"),
  ],
];

const create = [
  validateTenant,
  [
    body("pollutant")
      .optional()
      .notEmpty()
      .withMessage("the provided pollutant should not be empty IF provided")
      .bail()
      .trim()
      .isIn(["no2", "pm2_5", "pm10", "pm1"])
      .withMessage(
        "the pollutant value is not among the expected ones which include: no2, pm2_5, pm10, pm1",
      ),
    body("frequency")
      .optional()
      .notEmpty()
      .withMessage("the provided frequently should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["daily", "hourly", "monthly"])
      .withMessage(
        "the frequency value is not among the expected ones which include: daily, hourly and monthly",
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
        "the chartType value is not among the expected ones which include: bar, line and pie",
      ),
    body("startDate")
      .optional()
      .notEmpty()
      .withMessage("the provided startDate should not be empty IF provided")
      .bail()
      .trim()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("startDate must be a valid datetime."),
    body("endDate")
      .optional()
      .notEmpty()
      .withMessage("the provided endDate should not be empty IF provided")
      .bail()
      .trim()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("endDate must be a valid datetime."),
    body("user")
      .exists()
      .withMessage("the user should be provided in the request body")
      .bail()
      .notEmpty()
      .withMessage("the provided user should not be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("chartTitle")
      .optional()
      .notEmpty()
      .withMessage("the provided chartTitle should not be empty IF provided")
      .trim(),
    body("period")
      .optional()
      .notEmpty()
      .withMessage("the provided period should not be empty IF provided")
      .bail()
      .custom((value) => {
        return typeof value === "object";
      })
      .bail()
      .withMessage("the period should be an object"),
    body("chartSubTitle")
      .optional()
      .notEmpty()
      .withMessage("the provided chartSubTitle should not be empty IF provided")
      .trim(),
    body("airqloud")
      .optional()
      .notEmpty()
      .withMessage("the provided airqloud should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the airqloud must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("sites")
      .optional()
      .notEmpty()
      .withMessage("the provided sites should not be empty IF provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the sites should be an array"),
    body("sites.*")
      .optional()
      .notEmpty()
      .withMessage("the provided site should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("site must be an object ID"),
    body("devices")
      .optional()
      .notEmpty()
      .withMessage("the provided devices should not be empty IF provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the devices should be an array"),
    body("devices.*")
      .optional()
      .notEmpty()
      .withMessage("the provided device should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("device must be an object ID"),
  ],
];

const list = [
  validateTenant,
  [
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
    query("user")
      .optional()
      .notEmpty()
      .withMessage("the provided user should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user must be an object ID")
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
    query("airqloud")
      .optional()
      .notEmpty()
      .withMessage("the provided airqloud should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the airqloud must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("site")
      .optional()
      .notEmpty()
      .withMessage("the provided site should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the site must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const deleteDefault = [validateTenant, validateIdOrUserId];

module.exports = {
  tenant: validateTenant,
  pagination,
  update,
  create,
  list,
  deleteDefault,
};
