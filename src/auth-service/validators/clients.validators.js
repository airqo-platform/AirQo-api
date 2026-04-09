// clients.validators.js
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
    body("user_id")
      .exists()
      .withMessage("the user_id is missing in the request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("name")
      .exists()
      .withMessage("the name is missing in your request")
      .trim(),
    body("ip_address")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("the ip_address must not be empty IF provided")
      .bail()
      .isIP()
      .withMessage("Invalid IP address"),
    body("ip_addresses")
      .optional()
      .custom((value) => Array.isArray(value))
      .withMessage("the ip_addresses should be an array")
      .bail()
      .notEmpty()
      .withMessage("the ip_addresses should not be empty IF provided"),
    body("ip_addresses.*").isIP().withMessage("Invalid IP address provided"),
    body("redirect_url")
      .optional()
      .notEmpty()
      .withMessage("the redirect_url cannot be empty if provided")
      .bail()
      .trim()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the redirect_url cannot have spaces in it")
      .bail()
      .isURL()
      .withMessage("the redirect_url is not a valid URL")
      .trim(),
  ],
];

const validateClientIdParam = oneOf([
  param("client_id")
    .exists()
    .withMessage("the client_id param is missing in the request")
    .bail()
    .notEmpty()
    .withMessage("this client_id cannot be empty")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("client_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const updateClientSecret = [validateTenant, validateClientIdParam];

const update = [
  validateTenant,
  validateClientIdParam,
  [
    body("client_id")
      .not()
      .exists()
      .withMessage("the client_id should not exist in the request body"),
    body("client_secret")
      .not()
      .exists()
      .withMessage("the client_secret should not exist in the request body"),
    body("name")
      .optional()
      .notEmpty()
      .withMessage("name should not be empty if provided")
      .trim(),
    body("ip_address")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("the ip_address must not be empty IF provided")
      .bail()
      .isIP()
      .withMessage("Invalid IP address"),
    body("ip_addresses")
      .optional()
      .custom((value) => Array.isArray(value))
      .withMessage("the ip_addresses should be an array")
      .bail()
      .notEmpty()
      .withMessage("the ip_addresses should not be empty IF provided"),
    body("ip_addresses.*").isIP().withMessage("Invalid IP address provided"),
    body("redirect_url")
      .optional()
      .notEmpty()
      .withMessage("redirect_url should not be empty if provided")
      .trim()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the redirect_url cannot have spaces in it")
      .bail()
      .isURL()
      .withMessage("the redirect_url is not a valid URL")
      .trim(),
  ],
];

const activateClient = [
  validateTenant,
  validateClientIdParam,
  [
    body("isActive")
      .exists()
      .withMessage("isActive field is missing")
      .bail()
      .notEmpty()
      .withMessage("isActive should not be empty if provided")
      .bail()
      .isBoolean()
      .withMessage("isActive should be a Boolean value")
      .trim(),
  ],
];

const activateClientRequest = [validateTenant, validateClientIdParam];

const deleteClient = [validateTenant, validateClientIdParam];

const getClientById = [validateTenant, validateClientIdParam];

module.exports = {
  tenant: validateTenant,
  pagination,
  list,
  create,
  updateClientSecret,
  update,
  activateClient,
  activateClientRequest,
  deleteClient,
  getClientById,
};
