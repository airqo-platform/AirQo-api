// groups.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant cannot be empty if provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones"),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const validateGroupIdParam = oneOf([
  param("grp_id")
    .exists()
    .withMessage("the group ID parameter is missing in request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the group ID parameter must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const validateUserIdParam = oneOf([
  param("user_id")
    .exists()
    .withMessage("the user ID parameter is missing in the request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the user ID parameter must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const deleteGroup = [validateTenant, validateGroupIdParam];

const update = [
  validateTenant,
  validateGroupIdParam,
  [
    body("grp_description")
      .optional()
      .notEmpty()
      .withMessage("the grp_description should not be empty if provided")
      .trim(),
    body("grp_country")
      .optional()
      .notEmpty()
      .withMessage("the grp_country should not be empty if provided")
      .bail()
      .trim(),
    body("grp_timezone")
      .optional()
      .notEmpty()
      .withMessage("the grp_timezone should not be empty if provided")
      .bail()
      .trim(),
    body("grp_industry")
      .optional()
      .notEmpty()
      .withMessage("the grp_industry should not be empty if provided")
      .bail()
      .trim(),
    body("grp_image")
      .optional()
      .notEmpty()
      .withMessage("the grp_image should not be empty if provided")
      .bail()
      .trim(),
    body("grp_website")
      .optional()
      .notEmpty()
      .withMessage("the grp_website should not be empty if provided")
      .bail()
      .isURL()
      .withMessage("the grp_website must be a valid URL")
      .trim(),
    body("grp_status")
      .optional()
      .notEmpty()
      .withMessage("the grp_status should not be empty if provided")
      .bail()
      .trim()
      .toUpperCase()
      .isIn(["INACTIVE", "ACTIVE"])
      .withMessage(
        "the grp_status value is not among the expected ones, use ACTIVE or INACTIVE"
      ),
  ],
];

const list = [
  validateTenant,
  oneOf([
    query("grp_id")
      .optional()
      .isMongoId()
      .withMessage("grp_id must be an object ID IF provided")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("grp_title")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("grp_title should not be empty IF provided")
      .bail(),
    query("grp_status")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("grp_status should not be empty IF provided")
      .bail()
      .trim()
      .toUpperCase()
      .isIn(["INACTIVE", "ACTIVE"])
      .withMessage(
        "the grp_status value is not among the expected ones, use ACTIVE or INACTIVE"
      ),
  ]),
];

const create = [
  validateTenant,
  [
    body("grp_title")
      .exists()
      .withMessage("the grp_title is required")
      .bail()
      .notEmpty()
      .withMessage("the grp_title should not be empty")
      .trim(),
    body("grp_description")
      .exists()
      .withMessage("the grp_description is required")
      .bail()
      .notEmpty()
      .withMessage("the grp_description should not be empty")
      .trim(),
    body("user_id")
      .optional()
      .notEmpty()
      .withMessage("the user_id should not be empty IF provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("grp_country")
      .optional()
      .notEmpty()
      .withMessage("the grp_country should not be empty if provided")
      .bail()
      .trim(),
    body("grp_image")
      .optional()
      .notEmpty()
      .withMessage("the grp_image should not be empty if provided")
      .bail()
      .trim(),
    body("grp_timezone")
      .optional()
      .notEmpty()
      .withMessage("the grp_timezone should not be empty if provided")
      .bail()
      .trim(),
    body("grp_industry")
      .optional()
      .notEmpty()
      .withMessage("the grp_industry should not be empty if provided")
      .bail()
      .trim(),
    body("grp_website")
      .optional()
      .notEmpty()
      .withMessage("the grp_website should not be empty if provided")
      .bail()
      .isURL()
      .withMessage("the grp_website must be a valid URL"),
  ],
];

const removeUniqueConstraint = [validateTenant];

const assignOneUser = [
  validateTenant,
  validateGroupIdParam,
  validateUserIdParam,
];

const listSummary = [validateTenant];

const setManager = [validateTenant, validateGroupIdParam, validateUserIdParam];

const listAssignedUsers = [validateTenant, validateGroupIdParam];

const listAllGroupUsers = [validateTenant, validateGroupIdParam];

const listAvailableUsers = [validateTenant, validateGroupIdParam];

const assignUsers = [
  validateTenant,
  validateGroupIdParam,
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
  validateGroupIdParam,
  validateUserIdParam,
];

const unAssignManyUsers = [
  validateTenant,
  validateGroupIdParam,
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

const listRolesForGroup = [
  validateTenant,
  [
    param("grp_id")
      .exists()
      .withMessage("the group ID param is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("the group ID param cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the group ID provided must be an object ID"),
  ],
];

const getGroupById = [
  validateTenant,
  [
    param("grp_id")
      .optional()
      .isMongoId()
      .withMessage("grp_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  deleteGroup,
  update,
  list,
  create,
  removeUniqueConstraint,
  assignOneUser,
  listSummary,
  setManager,
  listAssignedUsers,
  listAllGroupUsers,
  listAvailableUsers,
  assignUsers,
  unAssignUser,
  unAssignManyUsers,
  listRolesForGroup,
  getGroupById,
};
