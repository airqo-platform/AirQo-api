// @validators/scopes.validators.js

const { query, body, param, oneOf } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

// Validate tenant parameter
const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
    .isIn(["kcca", "airqo", "airqount"])
    .withMessage("the tenant value is not among the expected ones"),
]);

// Pagination validation
const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

// Validate scope ID parameter
const validateScopeIdParam = oneOf([
  param("scope_id")
    .exists()
    .withMessage("the scope_id parameter is missing in the request")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("the scope_id must not be empty")
    .bail()
    .isMongoId()
    .withMessage("scope_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

// Validate scope creation
const validateCreate = [
  validateTenant,
  [
    body("scope")
      .exists()
      .withMessage("scope is required")
      .trim()
      .notEmpty()
      .withMessage("scope should not be empty"),
    body("description")
      .exists()
      .withMessage("description is required")
      .trim()
      .notEmpty()
      .withMessage("description should not be empty"),
    body("tier")
      .exists()
      .withMessage("tier is required")
      .trim()
      .notEmpty()
      .withMessage("tier should not be empty")
      .isIn(["Free", "Standard", "Premium"])
      .withMessage("tier must be Free, Standard, or Premium"),
    body("resource_type")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("resource_type should not be empty if provided")
      .isIn([
        "measurements",
        "sites",
        "devices",
        "cohorts",
        "grids",
        "forecasts",
        "insights",
      ])
      .withMessage("resource_type must be one of the allowed values"),
    body("access_type")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("access_type should not be empty if provided")
      .isIn(["read", "write"])
      .withMessage("access_type must be read or write"),
    body("data_timeframe")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("data_timeframe should not be empty if provided")
      .isIn(["recent", "historical", "all"])
      .withMessage("data_timeframe must be recent, historical, or all"),
  ],
];

// Validate bulk scope creation
const validateCreateBulk = [
  validateTenant,
  [
    body("scopes")
      .exists()
      .withMessage("scopes array is required")
      .isArray()
      .withMessage("scopes must be an array")
      .notEmpty()
      .withMessage("scopes array should not be empty"),
    body("scopes.*.scope")
      .exists()
      .withMessage("scope is required for each item")
      .trim()
      .notEmpty()
      .withMessage("scope should not be empty for any item"),
    body("scopes.*.description")
      .exists()
      .withMessage("description is required for each item")
      .trim()
      .notEmpty()
      .withMessage("description should not be empty for any item"),
    body("scopes.*.tier")
      .exists()
      .withMessage("tier is required for each item")
      .trim()
      .notEmpty()
      .withMessage("tier should not be empty for any item")
      .isIn(["Free", "Standard", "Premium"])
      .withMessage("tier must be Free, Standard, or Premium for each item"),
  ],
];

// Validate scope update
const validateUpdate = [
  validateTenant,
  validateScopeIdParam,
  [
    body("scope")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("scope should not be empty if provided"),
    body("description")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("description should not be empty if provided"),
    body("tier")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("tier should not be empty if provided")
      .isIn(["Free", "Standard", "Premium"])
      .withMessage("tier must be Free, Standard, or Premium"),
    body("resource_type")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("resource_type should not be empty if provided")
      .isIn([
        "measurements",
        "sites",
        "devices",
        "cohorts",
        "grids",
        "forecasts",
        "insights",
      ])
      .withMessage("resource_type must be one of the allowed values"),
    body("access_type")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("access_type should not be empty if provided")
      .isIn(["read", "write"])
      .withMessage("access_type must be read or write"),
    body("data_timeframe")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("data_timeframe should not be empty if provided")
      .isIn(["recent", "historical", "all"])
      .withMessage("data_timeframe must be recent, historical, or all"),
  ],
];

// Validate scope deletion
const validateDelete = [validateTenant, validateScopeIdParam];

// Validate get by ID
const validateGetById = [validateTenant, validateScopeIdParam];

// Validate scope listing
const validateList = [
  validateTenant,
  [
    query("tier")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("tier should not be empty if provided")
      .isIn(["Free", "Standard", "Premium"])
      .withMessage("tier must be Free, Standard, or Premium"),
  ],
];

module.exports = {
  pagination,
  create: validateCreate,
  update: validateUpdate,
  deleteScope: validateDelete,
  getById: validateGetById,
  list: validateList,
  createBulk: validateCreateBulk,
};
