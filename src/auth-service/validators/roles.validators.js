// roles.validators.js
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

const validateNetworkId = oneOf([
  query("network_id")
    .optional()
    .notEmpty()
    .withMessage("network_id must not be empty if provided")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("network_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const validateGroupId = oneOf([
  query("group_id")
    .optional()
    .notEmpty()
    .withMessage("group_id must not be empty if provided")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("groups_id must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const validateRoleIdParam = oneOf([
  param("role_id")
    .exists()
    .withMessage("the role ID param is missing in the request")
    .bail()
    .trim()
    .isMongoId()
    .withMessage("the role ID must be an object ID")
    .bail()
    .customSanitizer((value) => {
      return ObjectId(value);
    }),
]);

const list = [validateTenant, validateNetworkId, validateGroupId];

const listSummary = [validateTenant];

const create = [
  validateTenant,
  oneOf([
    body("network_id")
      .exists()
      .withMessage(
        "the organisation identifier is missing in request, consider using the network_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("network_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("group_id")
      .exists()
      .withMessage(
        "the organisation identifier is missing in request, consider using the group_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("group_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),

  [
    body("role_code")
      .optional()
      .notEmpty()
      .withMessage("role_code should not be empty IF provided")
      .bail()
      .notEmpty()
      .withMessage("the role_code must not be empty")
      .bail()
      .trim()
      .escape()
      .customSanitizer((value) => {
        return value.replace(/ /g, "_").toUpperCase();
      }),
    body("role_name")
      .exists()
      .withMessage("role_name is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the role_name must not be empty")
      .bail()
      .trim()
      .escape()
      .customSanitizer((value) => {
        return value.replace(/ /g, "_").toUpperCase();
      }),
    body("role_status")
      .optional()
      .notEmpty()
      .withMessage("role_status must not be empty if provided")
      .bail()
      .isIn(["ACTIVE", "INACTIVE"])
      .withMessage(
        "the role_status value is not among the expected ones: ACTIVE or INACTIVE"
      )
      .trim(),
    body("role_permission")
      .optional()
      .notEmpty()
      .withMessage("role_permission must not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the role_permission must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const update = [
  validateTenant,
  validateRoleIdParam,
  [
    body("role_status")
      .optional()
      .notEmpty()
      .withMessage("the role_status should not be empty if provided")
      .bail()
      .toUpperCase()
      .isIn(["ACTIVE", "INACTIVE"])
      .withMessage(
        "the status value is not among the expected ones which include: ACTIVE, INACTIVE"
      )
      .trim(),
    body("role_name")
      .not()
      .isEmpty()
      .withMessage("the role_name should not be provided when updating")
      .trim(),
    body("role_code")
      .not()
      .isEmpty()
      .withMessage("the role_code should not be provided when updating")
      .trim(),
    body("network_id")
      .optional()
      .notEmpty()
      .withMessage("network_id must not be empty if provided")
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
      .withMessage("group_id must not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("group_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("role_permission")
      .optional()
      .notEmpty()
      .withMessage("role_permission must not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the role_permission must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const deleteRole = [validateTenant, validateRoleIdParam];

const listUsersWithRole = [validateTenant, validateRoleIdParam];

const listAvailableUsersForRole = [validateTenant, validateRoleIdParam];

const assignManyUsersToRole = [
  validateTenant,
  validateRoleIdParam,
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
];

const assignUserToRole = [
  validateTenant,
  validateRoleIdParam,
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

const assignUserToRolePut = [
  validateTenant,
  validateRoleIdParam,
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

const unAssignManyUsersFromRole = [
  validateTenant,
  validateRoleIdParam,
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
];

const unAssignUserFromRole = [
  validateTenant,
  validateRoleIdParam,
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

const listPermissionsForRole = [validateTenant, validateRoleIdParam];

const listAvailablePermissionsForRole = [validateTenant, validateRoleIdParam];

const assignPermissionToRole = [
  validateTenant,
  validateRoleIdParam,
  [
    body("permissions")
      .exists()
      .withMessage("the permissions is missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("the permissions should not be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the permissions should be an array"),
    body("permissions.*")
      .isMongoId()
      .withMessage("the permission provided must be an object ID"),
  ],
];

const unAssignManyPermissionsFromRole = [
  validateTenant,
  validateRoleIdParam,
  [
    body("permission_ids")
      .exists()
      .withMessage("the permission_ids are missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("the permission_ids should not be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the permission_ids should be an array"),
    body("permission_ids.*")
      .isMongoId()
      .withMessage("Every permission_id provided must be an object ID"),
  ],
];

const updateRolePermissions = [
  validateTenant,
  validateRoleIdParam,
  [
    body("permission_ids")
      .exists()
      .withMessage("the permission_ids are missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("the permission_ids should not be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the permission_ids should be an array"),
    body("permission_ids.*")
      .isMongoId()
      .withMessage("Every permission_id provided must be an object ID"),
  ],
];

const unAssignPermissionFromRole = [
  validateTenant,
  validateRoleIdParam,
  [
    param("permission_id")
      .exists()
      .withMessage("the permission ID param is missing in the request")
      .bail()
      .notEmpty()
      .withMessage("the permission ID param cannot be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the permission ID must be an object ID"),
  ],
];

const getRoleById = [validateTenant, validateRoleIdParam];

module.exports = {
  tenant: validateTenant,
  pagination,
  list,
  listSummary,
  create,
  update,
  deleteRole,
  listUsersWithRole,
  listAvailableUsersForRole,
  assignManyUsersToRole,
  assignUserToRole,
  assignUserToRolePut,
  unAssignManyUsersFromRole,
  unAssignUserFromRole,
  listPermissionsForRole,
  listAvailablePermissionsForRole,
  assignPermissionToRole,
  unAssignManyPermissionsFromRole,
  updateRolePermissions,
  unAssignPermissionFromRole,
  getRoleById,
};
