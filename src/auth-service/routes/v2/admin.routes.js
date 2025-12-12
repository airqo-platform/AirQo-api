// admin.routes.js
const express = require("express");
const router = express.Router();
const createAdminController = require("@controllers/admin.controller");
const adminValidations = require("@validators/admin.validators");
const constants = require("@config/constants");
const { enhancedJWTAuth } = require("@middleware/passport");
const { requirePermissions } = require("@middleware/permissionAuth");
const {
  requireGroupAdminAccess,
  requireGroupAdmin,
  requireSuperAdminAccess,
} = require("@middleware/groupNetworkAuth");

const { validate, headers, pagination } = require("@validators/common");
router.use(headers); // Keep headers global

router.post(
  "/super-admin",
  adminValidations.setupSuperAdmin,
  enhancedJWTAuth,
  requireSuperAdminAccess,
  createAdminController.setupSuperAdmin
);

router.post(
  "/super-admin/enhanced",
  adminValidations.enhancedSetupSuperAdmin,
  enhancedJWTAuth,
  requireSuperAdminAccess,
  createAdminController.enhancedSetupSuperAdmin
);

router.get(
  "/rbac-health",
  adminValidations.checkRBACHealth,
  createAdminController.checkRBACHealth
);

router.post(
  "/rbac-reset",
  adminValidations.resetRBACSystem,
  adminValidations.validateProductionSafety,
  createAdminController.resetRBACSystem
);

router.post(
  "/rbac-initialize",
  adminValidations.initializeRBAC,
  createAdminController.initializeRBAC
);

router.get(
  "/rbac-status",
  adminValidations.getRBACStatus,
  createAdminController.getRBACStatus
);

router.get(
  "/system-diagnostics",
  adminValidations.getSystemDiagnostics,
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN]),
  createAdminController.getSystemDiagnostics
);

router.post(
  "/bulk-operations",
  adminValidations.bulkAdminOperations,
  adminValidations.batchOperationValidation,
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN]),
  createAdminController.bulkAdminOperations
);

router.get(
  "/audit/users",
  adminValidations.auditValidation,
  adminValidations.userSearchValidation,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN, constants.AUDIT_VIEW]),
  createAdminController.auditUsers
);

router.get(
  "/audit/roles",
  adminValidations.auditValidation,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN, constants.AUDIT_VIEW]),
  createAdminController.auditRoles
);

router.get(
  "/audit/permissions",
  adminValidations.auditValidation,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN, constants.AUDIT_VIEW]),
  createAdminController.auditPermissions
);

router.post(
  "/maintenance/cache-clear",
  adminValidations.cacheManagement,
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN]),
  createAdminController.clearCache
);

router.post(
  "/maintenance/database-cleanup",
  adminValidations.databaseCleanup,
  adminValidations.validateProductionSafety,
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN, constants.DATABASE_ADMIN]),
  createAdminController.databaseCleanup
);

router.post(
  "/maintenance/db/drop-index",
  enhancedJWTAuth,
  requirePermissions([constants.DATABASE_ADMIN]),
  adminValidations.validateProductionSafety,
  createAdminController.dropIndex
);

router.get(
  "/migration/deprecated-fields-status",
  adminValidations.auditValidation,
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN]),
  createAdminController.getDeprecatedFieldsStatus
);

router.post(
  "/migration/migrate-deprecated-fields",
  adminValidations.migrateDeprecatedFields,
  adminValidations.validateProductionSafety,
  adminValidations.batchOperationValidation,
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN]),
  createAdminController.migrateDeprecatedFields
);

router.get(
  "/config/current",
  enhancedJWTAuth,
  requirePermissions([constants.SUPER_ADMIN]),
  createAdminController.getCurrentConfig
);

router.get("/docs", createAdminController.getDocs);

module.exports = router;
