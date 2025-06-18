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
    body("grp_sites")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("grp_sites must be an array if provided")
      .bail()
      .custom((value) => {
        // Check for duplicates in the array
        if (Array.isArray(value)) {
          return new Set(value).size === value.length;
        }
        return true;
      })
      .withMessage("Duplicate site IDs are not allowed in grp_sites"),
    body("grp_sites.*")
      .optional()
      .isMongoId()
      .withMessage("Each site ID in grp_sites must be a valid ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
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
      .bail()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage(
        "the grp_title can only contain letters, numbers, spaces, hyphens and underscores"
      )
      .bail(),
    body("grp_sites")
      .optional()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("grp_sites must be an array if provided")
      .bail()
      .custom((value) => {
        // Check for duplicates in the array
        if (Array.isArray(value)) {
          return new Set(value).size === value.length;
        }
        return true;
      })
      .withMessage("Duplicate site IDs are not allowed in grp_sites"),
    body("grp_sites.*")
      .optional()
      .isMongoId()
      .withMessage("Each site ID in grp_sites must be a valid ObjectId")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("organization_slug")
      .optional()
      .notEmpty()
      .withMessage("organization_slug should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase alphanumeric with hyphens only")
      .bail()
      .isLength({ min: 2, max: 100 })
      .withMessage("Slug must be between 2 and 100 characters"),
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

const populateSlugs = [
  validateTenant,
  [
    query("dryRun")
      .optional()
      .isBoolean()
      .withMessage("dryRun must be a boolean value")
      .bail()
      .customSanitizer((value) => {
        return value === "true" || value === true;
      }),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage("limit must be an integer between 1 and 1000")
      .bail()
      .toInt(),
  ],
];

const updateSlug = [
  validateTenant,
  validateGroupIdParam,
  [
    body("slug")
      .optional()
      .notEmpty()
      .withMessage("slug should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .withMessage("Slug must be lowercase alphanumeric with hyphens only")
      .bail()
      .isLength({ min: 2, max: 100 })
      .withMessage("Slug must be between 2 and 100 characters"),
    body("regenerate")
      .optional()
      .isBoolean()
      .withMessage("regenerate must be a boolean value")
      .bail()
      .customSanitizer((value) => {
        return value === "true" || value === true;
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
  populateSlugs,
  updateSlug,
};
