// admin.validators.js
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

const validateSecretField = body("secret")
  .optional()
  .notEmpty()
  .withMessage("the secret should not be empty if provided");

const setupSuperAdmin = [
  validateTenant,
  [
    validateSecretField,
    body("user_id")
      .exists()
      .withMessage("user_id is required in the request body")
      .bail()
      .notEmpty()
      .withMessage("user_id must not be empty")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const checkRBACHealth = [
  validateTenant,
  [
    query("include_details")
      .optional()
      .isBoolean()
      .withMessage("include_details must be a boolean")
      .toBoolean(),
  ],
];

const resetRBACSystem = [
  validateTenant,
  [
    validateSecretField,
    body("dry_run")
      .optional()
      .isBoolean()
      .withMessage("dry_run must be a boolean")
      .toBoolean(),
    body("reset_permissions")
      .optional()
      .isBoolean()
      .withMessage("reset_permissions must be a boolean")
      .toBoolean(),
    body("reset_roles")
      .optional()
      .isBoolean()
      .withMessage("reset_roles must be a boolean")
      .toBoolean(),
    body("reset_user_roles")
      .optional()
      .isBoolean()
      .withMessage("reset_user_roles must be a boolean")
      .toBoolean(),
  ],
];

const initializeRBAC = [
  validateTenant,
  [
    validateSecretField,
    body("force")
      .optional()
      .isBoolean()
      .withMessage("force must be a boolean")
      .toBoolean(),
  ],
];

const getRBACStatus = [
  validateTenant,
  [
    query("include_user_details")
      .optional()
      .isBoolean()
      .withMessage("include_user_details must be a boolean")
      .toBoolean(),
    query("include_role_details")
      .optional()
      .isBoolean()
      .withMessage("include_role_details must be a boolean")
      .toBoolean(),
  ],
];

const enhancedSetupSuperAdmin = [
  validateTenant,
  [
    validateSecretField,
    body("user_id")
      .optional()
      .notEmpty()
      .withMessage("user_id must not be empty if provided")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("user_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("include_before_after")
      .optional()
      .isBoolean()
      .withMessage("include_before_after must be a boolean")
      .toBoolean(),
  ],
];

const getSystemDiagnostics = [
  validateTenant,
  [
    query("include_users")
      .optional()
      .isBoolean()
      .withMessage("include_users must be a boolean")
      .toBoolean(),
    query("include_cache_stats")
      .optional()
      .isBoolean()
      .withMessage("include_cache_stats must be a boolean")
      .toBoolean(),
    query("include_performance_metrics")
      .optional()
      .isBoolean()
      .withMessage("include_performance_metrics must be a boolean")
      .toBoolean(),
  ],
];

const bulkAdminOperations = [
  validateTenant,
  [
    validateSecretField,
    body("operation")
      .exists()
      .withMessage("operation is missing in the request body")
      .bail()
      .notEmpty()
      .withMessage("operation should not be empty")
      .bail()
      .isIn(["setup_super_admin", "remove_super_admin", "audit_users"])
      .withMessage(
        "operation must be one of: setup_super_admin, remove_super_admin, audit_users",
      ),
    body("user_ids")
      .optional()
      .custom((value) => Array.isArray(value))
      .withMessage("user_ids must be an array"),
    body("user_ids.*")
      .isMongoId()
      .withMessage("each user_id must be an object ID"),
    body("dry_run")
      .optional()
      .isBoolean()
      .withMessage("dry_run must be a boolean")
      .toBoolean(),
  ],
];

const validateProductionSafety = [
  body("confirm_production")
    .if(() => process.env.NODE_ENV === "production")
    .notEmpty()
    .withMessage("confirm_production is required in production environment")
    .equals("true")
    .withMessage("confirm_production must be 'true' to proceed in production"),
  body("dry_run")
    .if(() => process.env.NODE_ENV === "production")
    .optional()
    .equals(true)
    .withMessage("dry_run is recommended for production operations"),
];

const auditValidation = [
  validateTenant,
  [
    query("include_user_details")
      .optional()
      .isBoolean()
      .withMessage("include_user_details must be a boolean")
      .toBoolean(),
    query("export_format")
      .optional()
      .isIn(["json", "csv", "xlsx"])
      .withMessage("export_format must be one of: json, csv, xlsx")
      .toLowerCase(),
    query("date_from")
      .optional()
      .isISO8601()
      .withMessage("date_from must be a valid ISO 8601 date"),
    query("date_to")
      .optional()
      .isISO8601()
      .withMessage("date_to must be a valid ISO 8601 date"),
  ],
];

const userSearchValidation = [
  query("search")
    .optional()
    .isString()
    .withMessage("search must be a string")
    .isLength({ min: 1, max: 100 })
    .withMessage("search must be between 1 and 100 characters"),
  query("role_filter")
    .optional()
    .isString()
    .withMessage("role_filter must be a string"),
  query("status_filter")
    .optional()
    .isIn(["active", "inactive", "pending", "all"])
    .withMessage(
      "status_filter must be one of: active, inactive, pending, all",
    ),
  query("sort_by")
    .optional()
    .isIn(["email", "firstName", "lastName", "createdAt", "lastLogin"])
    .withMessage(
      "sort_by must be one of: email, firstName, lastName, createdAt, lastLogin",
    ),
  query("sort_order")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("sort_order must be either 'asc' or 'desc'"),
];

const batchOperationValidation = [
  body("batch_size")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("batch_size must be between 1 and 1000"),
  body("continue_on_error")
    .optional()
    .isBoolean()
    .withMessage("continue_on_error must be a boolean")
    .toBoolean(),
  body("rollback_on_failure")
    .optional()
    .isBoolean()
    .withMessage("rollback_on_failure must be a boolean")
    .toBoolean(),
];

const cacheManagement = [validateTenant, [validateSecretField]];

const databaseCleanup = [validateTenant, [validateSecretField]];

const migrateDeprecatedFields = [validateTenant, [validateSecretField]];

module.exports = {
  tenant: validateTenant,
  pagination,
  validateUserIdParam,
  setupSuperAdmin,
  checkRBACHealth,
  resetRBACSystem,
  initializeRBAC,
  getRBACStatus,
  enhancedSetupSuperAdmin,
  getSystemDiagnostics,
  bulkAdminOperations,
  validateProductionSafety,
  auditValidation,
  userSearchValidation,
  batchOperationValidation,
  cacheManagement,
  databaseCleanup,
  migrateDeprecatedFields,
};
