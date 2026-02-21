// roles.validators.js
const {
  query,
  body,
  param,
  oneOf,
  validationResult,
} = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

const validateTenant = query("tenant")
  .optional()
  .notEmpty()
  .withMessage("tenant cannot be empty if provided")
  .trim()
  .toLowerCase()
  .bail()
  .isIn(constants.TENANTS)
  .withMessage("the tenant value is not among the expected ones");

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
  body().custom((value, { req }) => {
    const { network_id, group_id } = req.body;

    if (!network_id && !group_id) {
      throw new Error("Either network_id or group_id must be provided");
    }

    if (network_id && group_id) {
      throw new Error("Cannot provide both network_id and group_id");
    }

    return true;
  }),
  oneOf([
    body("network_id")
      .exists()
      .withMessage(
        "the organisation identifier is missing in request, consider using the network_id",
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
        "the organisation identifier is missing in request, consider using the group_id",
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
      .withMessage(
        "role_code should not be empty IF provided (will auto-generate from role_name if omitted)",
      )
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
        "the role_status value is not among the expected ones: ACTIVE or INACTIVE",
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
        "the status value is not among the expected ones which include: ACTIVE, INACTIVE",
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
    body("user_type")
      .optional()
      .notEmpty()
      .withMessage("user_type should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn([
        "guest",
        "member",
        "admin",
        "super_admin",
        "viewer",
        "contributor",
        "moderator",
      ])
      .withMessage("the user_type value is not among the expected ones"),
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

const getUserRolesWithFilters = [
  param("user_id")
    .exists()
    .withMessage("user_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId"),

  validateTenant,

  query("group_id")
    .optional()
    .isMongoId()
    .withMessage("group_id must be a valid MongoDB ObjectId"),

  query("network_id")
    .optional()
    .isMongoId()
    .withMessage("network_id must be a valid MongoDB ObjectId"),

  query("include_all_groups")
    .optional()
    .isIn(["true", "false"])
    .withMessage("include_all_groups must be 'true' or 'false'"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    next();
  },
];

const getUserPermissionsForGroup = [
  param("user_id")
    .exists()
    .withMessage("user_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId"),

  // Support both param and query for group_id for flexibility
  param("group_id")
    .optional()
    .isMongoId()
    .withMessage("group_id in URL must be a valid MongoDB ObjectId"),

  query("group_id")
    .optional()
    .isMongoId()
    .withMessage("group_id in query must be a valid MongoDB ObjectId"),

  validateTenant,

  // Custom validation to ensure group_id is provided either as param or query
  (req, res, next) => {
    const groupIdFromParam = req.params.group_id;
    const groupIdFromQuery = req.query.group_id;

    if (!groupIdFromParam && !groupIdFromQuery) {
      return res.status(400).json({
        success: false,
        message:
          "group_id is required either as URL parameter or query parameter",
        errors: [{ msg: "group_id is required", param: "group_id" }],
      });
    }

    // Normalize to query for consistent processing
    if (groupIdFromParam && !groupIdFromQuery) {
      req.query.group_id = groupIdFromParam;
    }

    next();
  },

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    next();
  },
];

const bulkPermissionsCheck = [
  param("user_id")
    .exists()
    .withMessage("user_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId"),

  body("group_ids")
    .exists()
    .withMessage("group_ids array is required")
    .bail()
    .isArray()
    .withMessage("group_ids must be an array")
    .bail()
    .custom((value) => {
      if (value.length === 0) {
        throw new Error("group_ids array cannot be empty");
      }
      if (value.length > 50) {
        throw new Error("group_ids array cannot contain more than 50 items");
      }
      // Validate each group_id is a valid MongoDB ObjectId
      const invalidIds = value.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id),
      );
      if (invalidIds.length > 0) {
        throw new Error(`Invalid MongoDB ObjectIds: ${invalidIds.join(", ")}`);
      }
      return true;
    }),

  body("permissions")
    .optional()
    .isArray()
    .withMessage("permissions must be an array")
    .bail()
    .custom((value) => {
      if (value.length > 100) {
        throw new Error("permissions array cannot contain more than 100 items");
      }
      // Validate permission names format
      const invalidPermissions = value.filter(
        (perm) =>
          typeof perm !== "string" || perm.length === 0 || perm.length > 100,
      );
      if (invalidPermissions.length > 0) {
        throw new Error(
          "All permissions must be non-empty strings with max 100 characters",
        );
      }
      return true;
    }),

  validateTenant,

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    next();
  },
];

const checkUserPermissionsForActions = [
  param("user_id")
    .exists()
    .withMessage("user_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId"),

  query("group_id")
    .exists()
    .withMessage("group_id query parameter is required")
    .bail()
    .isMongoId()
    .withMessage("group_id must be a valid MongoDB ObjectId"),

  body("actions")
    .exists()
    .withMessage("actions array is required")
    .bail()
    .isArray()
    .withMessage("actions must be an array")
    .bail()
    .custom((value) => {
      if (value.length === 0) {
        throw new Error("actions array cannot be empty");
      }
      if (value.length > 50) {
        throw new Error("actions array cannot contain more than 50 items");
      }
      // Validate action names format
      const invalidActions = value.filter(
        (action) =>
          typeof action !== "string" ||
          action.length === 0 ||
          action.length > 100,
      );
      if (invalidActions.length > 0) {
        throw new Error(
          "All actions must be non-empty strings with max 100 characters",
        );
      }
      return true;
    }),

  validateTenant,

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    next();
  },
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

const getUserRoles = [
  param("user_id")
    .exists()
    .withMessage("user_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId"),

  validateTenant,

  query("group_id")
    .optional()
    .isMongoId()
    .withMessage("group_id must be a valid MongoDB ObjectId"),

  query("network_id")
    .optional()
    .isMongoId()
    .withMessage("network_id must be a valid MongoDB ObjectId"),

  query("include_deprecated")
    .optional()
    .isIn(["true", "false"])
    .withMessage("include_deprecated must be 'true' or 'false'"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    next();
  },
];

const auditDeprecatedFields = [
  validateTenant,
  query("include_user_details")
    .optional()
    .isBoolean()
    .withMessage("include_user_details must be a boolean")
    .toBoolean(),
  query("export_format")
    .optional()
    .isIn(["json", "csv"])
    .withMessage("export_format must be either 'json' or 'csv'")
    .toLowerCase(),
];

const getEnhancedUserDetails = [
  param("user_id")
    .exists()
    .withMessage("user_id parameter is required")
    .bail()
    .isMongoId()
    .withMessage("user_id must be a valid MongoDB ObjectId"),

  validateTenant,

  query("include_deprecated")
    .optional()
    .isIn(["true", "false"])
    .withMessage("include_deprecated must be 'true' or 'false'"),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }
    next();
  },
];

const getSystemHealth = [validateTenant];

const bulkRoleOperations = [
  validateTenant,
  [
    body("operation")
      .exists()
      .withMessage("operation is missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("operation should not be empty")
      .bail()
      .isIn(["assign", "unassign", "reassign"])
      .withMessage("operation must be one of: assign, unassign, reassign"),

    body("user_ids")
      .exists()
      .withMessage("user_ids are missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("user_ids should not be empty")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("user_ids should be an array"),

    body("user_ids.*")
      .isMongoId()
      .withMessage("each user_id must be an object ID"),

    body("role_id")
      .exists()
      .withMessage("role_id is missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("role_id should not be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("role_id must be an object ID")
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
  ],
];

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
  getUserRoles,
  auditDeprecatedFields,
  getEnhancedUserDetails,
  getSystemHealth,
  bulkRoleOperations,
  getUserRolesWithFilters,
  getUserPermissionsForGroup,
  bulkPermissionsCheck,
  checkUserPermissionsForActions,
};
