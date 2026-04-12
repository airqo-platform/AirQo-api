// scopes.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");
const { SCOPE_ENUMS } = require("@models/Scope");

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

const list = [validateTenant];

const create = [
  validateTenant,
  [
    body("scope")
      .exists()
      .withMessage("scope is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the scope must not be empty")
      .bail()
      .trim()
      .escape()
      .customSanitizer((value) => {
        return value.replace(/ /g, "_").toUpperCase();
      }),
    body("network_id")
      .optional()
      .notEmpty()
      .withMessage("network_id should not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("network_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("description")
      .exists()
      .withMessage("description is missing in your request")
      .bail()
      .trim(),
    body("tier")
      .optional()
      .isIn(SCOPE_ENUMS.TIER)
      .withMessage(`tier must be one of: ${SCOPE_ENUMS.TIER.join(", ")}`),
    body("resource_type")
      .optional()
      .isIn(SCOPE_ENUMS.RESOURCE_TYPE)
      .withMessage(
        `resource_type must be one of: ${SCOPE_ENUMS.RESOURCE_TYPE.join(", ")}`
      ),
    body("access_type")
      .optional()
      .isIn(SCOPE_ENUMS.ACCESS_TYPE)
      .withMessage(`access_type must be one of: ${SCOPE_ENUMS.ACCESS_TYPE.join(", ")}`),
    body("data_timeframe")
      .optional()
      .isIn(SCOPE_ENUMS.DATA_TIMEFRAME)
      .withMessage(
        `data_timeframe must be one of: ${SCOPE_ENUMS.DATA_TIMEFRAME.join(", ")}`
      ),
  ],
];

const update = [
  (req, res, next) => {
    if (!Object.keys(req.body).length) {
      return res.status(400).json({ errors: "request body is empty" });
    }
    next();
  },
  validateTenant,
  [
    param("scope_id")
      .exists()
      .withMessage("the scope_id param is missing in the request")
      .bail()
      .trim(),
  ],
  [
    body("scope")
      .not()
      .exists()
      .withMessage("scope should not exist in the request body"),
    body("network_id")
      .optional()
      .notEmpty()
      .withMessage("network_id should not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("network_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("description")
      .optional()
      .notEmpty()
      .withMessage("description should not be empty if provided")
      .trim(),
  ],
];

const deleteScope = [
  validateTenant,
  [
    param("scope_id")
      .exists()
      .withMessage("the scope_id param is missing in the request")
      .bail()
      .trim(),
  ],
];

const getById = [
  validateTenant,
  [
    param("scope_id")
      .exists()
      .withMessage("the scope_id param is missing in the request")
      .bail()
      .trim(),
  ],
];

const bulkCreate = [
  validateTenant,
  [
    body("scopes")
      .exists()
      .withMessage("scopes array is missing in your request")
      .bail()
      .isArray({ min: 1 })
      .withMessage("scopes must be a non-empty array"),
    body("scopes.*.scope")
      .exists()
      .withMessage("each scope item must have a scope field")
      .bail()
      .notEmpty()
      .withMessage("scope field must not be empty")
      .bail()
      .trim()
      .escape()
      .customSanitizer((value) => value.replace(/ /g, "_").toUpperCase()),
    body("scopes.*.description")
      .exists()
      .withMessage("each scope item must have a description field")
      .bail()
      .notEmpty()
      .withMessage("description field must not be empty")
      .bail()
      .trim(),
    body("scopes.*.network_id")
      .optional()
      .notEmpty()
      .withMessage("network_id should not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("network_id must be a valid MongoDB ObjectId")
      .bail()
      .customSanitizer((value) => ObjectId(value)),
    body("scopes.*.tier")
      .optional()
      .isIn(SCOPE_ENUMS.TIER)
      .withMessage(`tier must be one of: ${SCOPE_ENUMS.TIER.join(", ")}`),
    body("scopes.*.resource_type")
      .optional()
      .isIn(SCOPE_ENUMS.RESOURCE_TYPE)
      .withMessage(
        `resource_type must be one of: ${SCOPE_ENUMS.RESOURCE_TYPE.join(", ")}`
      ),
    body("scopes.*.access_type")
      .optional()
      .isIn(SCOPE_ENUMS.ACCESS_TYPE)
      .withMessage(`access_type must be one of: ${SCOPE_ENUMS.ACCESS_TYPE.join(", ")}`),
    body("scopes.*.data_timeframe")
      .optional()
      .isIn(SCOPE_ENUMS.DATA_TIMEFRAME)
      .withMessage(
        `data_timeframe must be one of: ${SCOPE_ENUMS.DATA_TIMEFRAME.join(", ")}`
      ),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  list,
  create,
  update,
  deleteScope,
  getById,
  bulkCreate,
};
