const { query, body, param } = require("express-validator");
const constants = require("@config/constants");

const tenantValidation = [
  query("tenant")
    .optional()
    .trim()
    .toLowerCase()
    .custom((value) => {
      if (!constants.TENANTS.includes(value)) {
        throw new Error(
          `Invalid tenant. Must be one of: ${constants.TENANTS.join(", ")}`
        );
      }
      return true;
    }),
];

const paginationValidation = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("limit must be an integer between 1 and 1000")
    .toInt(),
  query("skip")
    .optional()
    .isInt({ min: 0 })
    .withMessage("skip must be a non-negative integer")
    .toInt(),
];

const sdgValidations = {
  createCity: [
    ...tenantValidation,
    body("city_id")
      .notEmpty()
      .withMessage("city_id is required")
      .trim()
      .isString()
      .withMessage("city_id must be a string"),
    body("name")
      .notEmpty()
      .withMessage("name is required")
      .trim()
      .isString()
      .withMessage("name must be a string"),
    body("country")
      .notEmpty()
      .withMessage("country is required")
      .trim()
      .isLength({ min: 2, max: 2 })
      .withMessage("country must be a 2-letter ISO 3166-1 alpha-2 code")
      .isAlpha()
      .withMessage("country must contain only letters"),
    body("population")
      .notEmpty()
      .withMessage("population is required")
      .isInt({ min: 0 })
      .withMessage("population must be a non-negative integer")
      .toInt(),
    body("pop_weight")
      .notEmpty()
      .withMessage("pop_weight is required")
      .isFloat({ min: 0, max: 1 })
      .withMessage("pop_weight must be a number between 0 and 1")
      .toFloat(),
    body("year")
      .notEmpty()
      .withMessage("year is required")
      .isInt({ min: 1900, max: 2100 })
      .withMessage("year must be a valid 4-digit year")
      .toInt(),
    body("grids")
      .optional()
      .isArray()
      .withMessage("grids must be an array of strings"),
    body("grids.*")
      .optional()
      .isString()
      .withMessage("each grid must be a string")
      .trim(),
    body("monitoring_since")
      .optional()
      .isISO8601()
      .withMessage("monitoring_since must be a valid ISO 8601 date")
      .toDate(),
    body("grid_id")
      .optional()
      .isMongoId()
      .withMessage("grid_id must be a valid MongoDB ObjectId"),
  ],

  listCities: [
    ...tenantValidation,
    ...paginationValidation,
    query("country")
      .optional()
      .trim()
      .isLength({ min: 2, max: 2 })
      .withMessage("country must be a 2-letter ISO 3166-1 alpha-2 code")
      .isAlpha()
      .withMessage("country must contain only letters"),
    query("year")
      .optional()
      .isInt({ min: 1900, max: 2100 })
      .withMessage("year must be a valid 4-digit year")
      .toInt(),
  ],

  listCitySites: [
    ...tenantValidation,
    ...paginationValidation,
    param("city_id")
      .notEmpty()
      .withMessage("city_id is required")
      .trim()
      .isString()
      .withMessage("city_id must be a string"),
  ],

  listPopulationWeights: [
    ...tenantValidation,
    ...paginationValidation,
    query("year")
      .optional()
      .isInt({ min: 1900, max: 2100 })
      .withMessage("year must be a valid 4-digit year")
      .toInt(),
  ],

  uploadCities: [
    ...tenantValidation,
    query("country")
      .optional()
      .trim()
      .isLength({ min: 2, max: 2 })
      .withMessage("country must be a 2-letter ISO 3166-1 alpha-2 code")
      .isAlpha()
      .withMessage("country must contain only letters"),
    query("year")
      .optional()
      .isInt({ min: 1900, max: 2100 })
      .withMessage("year must be a valid 4-digit year")
      .toInt(),
  ],
};

module.exports = sdgValidations;
