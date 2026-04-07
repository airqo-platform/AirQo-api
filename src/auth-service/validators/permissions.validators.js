// permissions.validators.js
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

const list = [validateTenant];

const create = [
  validateTenant,
  [
    body("permission")
      .exists()
      .withMessage("permission is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the permission must not be empty")
      .bail()
      .trim()
      .escape()
      .customSanitizer((value) => {
        const sanitizedValue = value.replace(/[^a-zA-Z]/g, " ");
        const processedValue = sanitizedValue.toUpperCase().replace(/ /g, "_");

        return processedValue;
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
    body("group_id")
      .optional()
      .notEmpty()
      .withMessage("group_id should not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("group_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("description")
      .exists()
      .withMessage("description is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the description must not be empty")
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
    param("permission_id")
      .exists()
      .withMessage("the permission_id param is missing in the request")
      .bail()
      .trim(),
  ],
  [
    body("permission")
      .not()
      .exists()
      .withMessage("permission should not exist in the request body"),
    body("network_id")
      .optional()
      .notEmpty()
      .withMessage("network_id should not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("network_id must be an object ID")
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

const deletePermission = [validateTenant];

const getById = [validateTenant];

module.exports = {
  tenant: validateTenant,
  pagination,
  list,
  create,
  update,
  deletePermission,
  getById,
};
