// scopes.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

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
      .exists()
      .withMessage("network_id should be provided")
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

const createBulk = [
  validateTenant,
  [
    body("scopes")
      .exists()
      .withMessage("scopes array is missing in your request")
      .bail()
      .isArray()
      .withMessage("scopes must be an array")
      .bail()
      .notEmpty()
      .withMessage("scopes array must not be empty"),
    body("scopes.*.scope")
      .exists()
      .withMessage("scope is missing for one or more items")
      .bail()
      .notEmpty()
      .withMessage("the scope must not be empty")
      .bail()
      .trim()
      .escape()
      .customSanitizer((value) => {
        return value.replace(/ /g, "_").toUpperCase();
      }),
    body("scopes.*.network_id")
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
    body("scopes.*.description")
      .exists()
      .withMessage("description is missing for one or more items")
      .bail()
      .trim(),
    body("scopes.*.tier")
      .exists()
      .withMessage("subscription tier is missing for one or more items")
      .bail()
      .isIn(["Free", "Standard", "Premium"])
      .withMessage("tier must be one of: Free, Standard, Premium"),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  list,
  createBulk,
  create,
  update,
  deleteScope,
  getById,
};
