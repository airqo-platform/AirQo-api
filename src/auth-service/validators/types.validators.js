// types.validators.js
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

const validateUserTypeParam = oneOf([
  param("user_type")
    .exists()
    .withMessage("the user_type ID param is missing in the request")
    .bail()
    .notEmpty()
    .withMessage("the user_type cannot be empty if provided"),
]);

const validateOrgIdentifier = oneOf([
  query("net_id")
    .exists()
    .withMessage(
      "the organisational identifier is missing in request, consider using net_id",
    )
    .bail()
    .isMongoId()
    .withMessage("the net_id must be an Object ID"),
  query("grp_id")
    .exists()
    .withMessage(
      "the organisational identifier is missing in request, consider using grp_id",
    )
    .bail()
    .isMongoId()
    .withMessage("the grid_id must be an Object ID"),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const listUsersWithUserType = [
  validateTenant,
  validateOrgIdentifier,
  validateUserTypeParam,
];

const listAvailableUsersForUserType = [
  validateTenant,
  validateOrgIdentifier,
  validateUserTypeParam,
];

const assignManyUsersToUserType = [
  validateTenant,
  validateUserTypeParam,
  [
    body("user_ids")
      .exists()
      .withMessage("the user_ids are missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("the user_ids should not be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the user_ids should be an array"),
    body("user_ids.*")
      .isMongoId()
      .withMessage("user_id provided must be an object ID"),
  ],
  validateOrgIdentifier,
];

const assignUserType = [
  validateTenant,
  validateOrgIdentifier,
  validateUserTypeParam,
  [
    body("user")
      .exists()
      .withMessage("the user ID is missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("the user ID cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user ID must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const assignUserTypePut = [
  validateTenant,
  validateOrgIdentifier,
  validateUserTypeParam,
  [
    param("user_id")
      .exists()
      .withMessage("the user ID param is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user ID must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  listUsersWithUserType,
  listAvailableUsersForUserType,
  assignManyUsersToUserType,
  assignUserType,
  assignUserTypePut,
};
