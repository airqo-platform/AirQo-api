// networks.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const isEmpty = require("is-empty");

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
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

const validateNetworkIdParam = oneOf([
  param("net_id")
    .exists()
    .withMessage("the network ID param is missing in the request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the network ID must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const validateUserIdParam = oneOf([
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
]);

const assignOneUser = [
  validateTenant,
  validateNetworkIdParam,
  validateUserIdParam,
];

const list = [validateTenant];
const listSummary = [validateTenant];

const setManager = [
  validateTenant,
  validateNetworkIdParam,
  validateUserIdParam,
];

const listAssignedUsers = [validateTenant, validateNetworkIdParam];

const listAvailableUsers = [validateTenant, validateNetworkIdParam];

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
        "the net_connection_endpoint should not be empty IF provided"
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
        "the status value is not among the expected ones which include: active, inactive, pending"
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
        "the status value is not among the expected ones which include: business, research, policy, awareness, school, others"
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

const assignUsers = [
  validateTenant,
  validateNetworkIdParam,
  [
    body("user_ids")
      .exists()
      .withMessage("the user_ids should be provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the user_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the user_ids should not be empty"),
    body("user_ids.*")
      .isMongoId()
      .withMessage("user_id provided must be an object ID"),
  ],
];

const getNetworkFromEmail = [
  validateTenant,
  [
    body("net_email")
      .exists()
      .withMessage("the organization's net_email address is required")
      .bail()
      .notEmpty()
      .withMessage("the net_email should not be empty")
      .bail()
      .isEmail()
      .withMessage("This is not a valid email address")
      .trim(),
  ],
];

const unAssignManyUsers = [
  validateTenant,
  validateNetworkIdParam,
  [
    body("user_ids")
      .exists()
      .withMessage("the user_ids should be provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the user_ids should be an array")
      .bail()
      .notEmpty()
      .withMessage("the user_ids should not be empty"),
    body("user_ids.*")
      .isMongoId()
      .withMessage("user_id provided must be an object ID"),
  ],
];

const unAssignUser = [
  validateTenant,
  validateNetworkIdParam,
  validateUserIdParam,
];

const listRolesForNetwork = [
  validateTenant,
  [
    param("net_id")
      .exists()
      .withMessage("the network ID param is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("the network ID param cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the network provided must be an object ID"),
  ],
];

const getNetworkById = [
  validateTenant,
  [
    param("net_id")
      .optional()
      .isMongoId()
      .withMessage("net_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const deleteNetwork = [
  validateTenant,
  [
    param("net_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("net_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const update = [
  validateTenant,
  validateNetworkIdParam,
  [
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
      .optional()
      .notEmpty()
      .withMessage("the net_username should not be empty IF provided")
      .trim(),
    body("net_connection_endpoint")
      .optional()
      .notEmpty()
      .withMessage(
        "the net_connection_endpoint should not be empty IF provided"
      )
      .trim(),
    body("net_connection_string")
      .optional()
      .notEmpty()
      .withMessage("the net_connection_string should not be empty IF provided")
      .trim(),
    body("net_email")
      .optional()
      .notEmpty()
      .withMessage("the email should not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("net_website")
      .optional()
      .notEmpty()
      .withMessage("the net_website should not be empty if provided")
      .bail()
      .isURL()
      .withMessage("the net_website is not a valid URL")
      .trim(),
    body("net_status")
      .optional()
      .notEmpty()
      .withMessage("the net_status should not be empty if provided")
      .bail()
      .toLowerCase()
      .isIn(["active", "inactive", "pending"])
      .withMessage(
        "the net_status value is not among the expected ones which include: active, inactive, pending"
      )
      .trim(),
    body("net_phoneNumber")
      .optional()
      .notEmpty()
      .withMessage("the phoneNumber should not be empty if provided")
      .bail()
      .isMobilePhone()
      .withMessage("the phoneNumber is not a valid one")
      .bail()
      .trim(),
    body("net_category")
      .optional()
      .notEmpty()
      .withMessage("the net_category should not be empty if provided")
      .bail()
      .toLowerCase()
      .isIn(["business", "research", "policy", "awareness", "school", "others"])
      .withMessage(
        "the status value is not among the expected ones which include: business, research, policy, awareness, school, others"
      )
      .trim(),
    body("net_name")
      .optional()
      .notEmpty()
      .withMessage("the net_name should not be empty IF provided")
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the net_name can only contain letters, numbers, spaces, hyphens and underscores"
      )
      .bail(),
    body("net_users")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the net_users should be an array")
      .bail()
      .notEmpty()
      .withMessage("the net_users should not be empty"),
    body("net_data_source")
      .optional()
      .notEmpty()
      .withMessage("the data source should not be empty if provided")
      .bail(),
    body("net_api_key")
      .optional()
      .notEmpty()
      .withMessage("the net_api_key should not be empty IF provided")
      .bail(),
    body("net_users.*")
      .optional()
      .isMongoId()
      .withMessage("each use should be an object ID"),
  ],
];

const refresh = [
  validateTenant,
  validateNetworkIdParam,
  [
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
      .optional()
      .notEmpty()
      .withMessage("the net_username should not be empty IF provided")
      .trim(),
    body("net_connection_endpoint")
      .optional()
      .notEmpty()
      .withMessage(
        "the net_connection_endpoint should not be empty IF provided"
      )
      .trim(),
    body("net_connection_string")
      .optional()
      .notEmpty()
      .withMessage("the net_connection_string should not be empty IF provided")
      .trim(),
    body("net_email")
      .optional()
      .notEmpty()
      .withMessage("the email should not be empty if provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("net_website")
      .optional()
      .notEmpty()
      .withMessage("the net_website should not be empty if provided")
      .bail()
      .isURL()
      .withMessage("the net_website is not a valid URL")
      .trim(),
    body("net_status")
      .optional()
      .notEmpty()
      .withMessage("the net_status should not be empty if provided")
      .bail()
      .toLowerCase()
      .isIn(["active", "inactive", "pending"])
      .withMessage(
        "the net_status value is not among the expected ones which include: active, inactive, pending"
      )
      .trim(),
    body("net_phoneNumber")
      .optional()
      .notEmpty()
      .withMessage("the phoneNumber should not be empty if provided")
      .bail()
      .isMobilePhone()
      .withMessage("the phoneNumber is not a valid one")
      .bail()
      .trim(),
    body("net_category")
      .optional()
      .notEmpty()
      .withMessage("the net_category should not be empty if provided")
      .bail()
      .toLowerCase()
      .isIn(["business", "research", "policy", "awareness", "school", "others"])
      .withMessage(
        "the status value is not among the expected ones which include: business, research, policy, awareness, school, others"
      )
      .trim(),
    body("net_name")
      .if(body("net_name").exists())
      .notEmpty()
      .withMessage("the net_name should not be empty")
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the net_name can only contain letters, numbers, spaces, hyphens and underscores"
      )
      .bail(),
    body("net_users")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the net_users should be an array")
      .bail()
      .notEmpty()
      .withMessage("the net_users should not be empty"),
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
    body("net_users.*")
      .optional()
      .isMongoId()
      .withMessage("each use should be an object ID"),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  assignOneUser,
  list,
  listSummary,
  setManager,
  listAssignedUsers,
  listAvailableUsers,
  create,
  assignUsers,
  getNetworkFromEmail,
  unAssignManyUsers,
  unAssignUser,
  listRolesForNetwork,
  getNetworkById,
  deleteNetwork,
  update,
  refresh,
};
