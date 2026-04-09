// tenant-settings.validators.js
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

const validateIdParam = oneOf([
  param("id")
    .exists()
    .withMessage("the id param is missing in the request")
    .bail()
    .notEmpty()
    .withMessage("this id cannot be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const list = [validateTenant];

const listInformation = [validateTenant, validateIdParam];

const create = [
  validateTenant,
  body("defaultNetwork")
    .exists()
    .withMessage("the defaultNetwork is missing in the request body")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the defaultNetwork should be a valid object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("defaultNetworkRole")
    .exists()
    .withMessage("the defaultNetworkRole is missing in the request body")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the defaultNetworkRole should be a valid object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("defaultGroup")
    .exists()
    .withMessage("the defaultGroup is missing in the request body")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the defaultGroup should be a valid object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("defaultGroupRole")
    .exists()
    .withMessage("the defaultGroupRole is missing in the request body")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the defaultGroupRole should be a valid object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("tenant")
    .exists()
    .withMessage("the tenant is missing in the request body")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("the tenant field should not be empty")
    .bail()
    .toLowerCase()
    .isIn(["kcca", "airqo", "airqount"])
    .withMessage("the tenant value is not among the expected ones"),
];

const update = [
  validateTenant,
  validateIdParam,
  body("defaultNetwork")
    .optional()
    .trim()
    .isMongoId()
    .withMessage("the defaultNetwork should be a valid object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("defaultNetworkRole")
    .optional()
    .trim()
    .isMongoId()
    .withMessage("the defaultNetworkRole should be a valid object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("defaultGroup")
    .optional()
    .trim()
    .isMongoId()
    .withMessage("the defaultGroup should be a valid object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
  body("defaultGroupRole")
    .optional()
    .trim()
    .isMongoId()
    .withMessage("the defaultGroupRole should be a valid object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
];

const deleteTenantSetting = [validateTenant, validateIdParam];

module.exports = {
  pagination,
  list,
  listInformation,
  create,
  update,
  delete: deleteTenantSetting,
};
