// networks.validators.js
const { query, body, oneOf } = require("express-validator");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
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
    body("admin_secret")
      .exists()
      .withMessage("the admin secret is required")
      .bail()
      .notEmpty()
      .withMessage("the admin secret should not be empty"),
    body("net_specific_fields")
      .optional()
      .custom((value) => {
        return typeof value === "object";
      })
      .withMessage("the net_specific_fields should be an object")
      .bail()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the net_specific_fields should not be empty IF provided"),
    body("net_password")
      .optional()
      .notEmpty()
      .withMessage("the net_password should not be empty IF provided")
      .trim(),
    body("net_username")
      .exists()
      .withMessage("the net_username is required")
      .bail()
      .notEmpty()
      .withMessage("the net_username should not be empty IF provided")
      .trim(),
    body("net_connection_endpoint")
      .exists()
      .withMessage("the net_connection_endpoint is required")
      .bail()
      .notEmpty()
      .withMessage(
        "the net_connection_endpoint should not be empty IF provided",
      )
      .trim(),
    body("net_connection_string")
      .exists()
      .withMessage("the net_connection_string is required")
      .bail()
      .notEmpty()
      .withMessage("the net_connection_string should not be empty IF provided")
      .trim(),
    body("net_email")
      .exists()
      .withMessage("the network's email address is required")
      .bail()
      .isEmail()
      .withMessage("This is not a valid email address")
      .trim(),
    body("net_website")
      .exists()
      .withMessage("the net_network's website is required")
      .bail()
      .isURL()
      .withMessage("the net_website is not a valid URL")
      .trim(),
    body("net_status")
      .optional()
      .notEmpty()
      .withMessage("the net_status should not be empty")
      .bail()
      .toLowerCase()
      .isIn(["active", "inactive", "pending"])
      .withMessage(
        "the status value is not among the expected ones which include: active, inactive, pending",
      )
      .trim(),
    body("net_phoneNumber")
      .exists()
      .withMessage("the net_phoneNumber is required")
      .bail()
      .isMobilePhone()
      .withMessage("the net_phoneNumber is not a valid one")
      .bail()
      .trim(),
    body("net_category")
      .exists()
      .withMessage("the net_category is required")
      .bail()
      .toLowerCase()
      .isIn(["business", "research", "policy", "awareness", "school", "others"])
      .withMessage(
        "the status value is not among the expected ones which include: business, research, policy, awareness, school, others",
      )
      .trim(),
    body("net_description")
      .exists()
      .withMessage("the net_description is required")
      .trim(),
    body("net_data_source")
      .optional()
      .notEmpty()
      .withMessage("the data source should not be empty if provided")
      .bail(),
    body("net_api_key")
      .optional()
      .notEmpty()
      .withMessage("the api key should not be empty if provided")
      .bail(),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  list,
  create,
};
