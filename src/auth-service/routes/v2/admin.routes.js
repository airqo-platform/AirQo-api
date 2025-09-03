// admin.routes.js
const express = require("express");
const router = express.Router();
const createAdminController = require("@controllers/admin.controller");
const adminValidations = require("@validators/admin.validators");
const constants = require("@config/constants");
const { enhancedJWTAuth } = require("@middleware/passport");
const { requirePermissions } = require("@middleware/permissionAuth");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

router.use(headers);
router.use(adminValidations.pagination);

router.post(
  "/super-admin",
  adminValidations.setupSuperAdmin,
  enhancedJWTAuth,
  createAdminController.setupSuperAdmin
);

router.post(
  "/super-admin/enhanced",
  adminValidations.enhancedSetupSuperAdmin,
  enhancedJWTAuth,
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
  createAdminController.getSystemDiagnostics
);

router.post(
  "/bulk-operations",
  adminValidations.bulkAdminOperations,
  adminValidations.batchOperationValidation,
  enhancedJWTAuth,
  createAdminController.bulkAdminOperations
);

router.get(
  "/audit/users",
  adminValidations.auditValidation,
  adminValidations.userSearchValidation,
  enhancedJWTAuth,
  createAdminController.auditUsers
);

router.get(
  "/audit/roles",
  adminValidations.auditValidation,
  enhancedJWTAuth,
  createAdminController.auditRoles
);

router.get(
  "/audit/permissions",
  adminValidations.auditValidation,
  enhancedJWTAuth,
  createAdminController.auditPermissions
);

router.post(
  "/maintenance/cache-clear",
  adminValidations.cacheManagement,
  enhancedJWTAuth,
  createAdminController.clearCache
);

router.post(
  "/maintenance/database-cleanup",
  adminValidations.databaseCleanup,
  adminValidations.validateProductionSafety,
  enhancedJWTAuth,
  createAdminController.databaseCleanup
);

router.post(
  "/maintenance/db/drop-index",
  // Validation for collectionName, indexName, and secret is handled within the utility
  enhancedJWTAuth,
  requirePermissions([constants.DATABASE_ADMIN]),
  createAdminController.dropIndex
);

router.get(
  "/migration/deprecated-fields-status",
  adminValidations.auditValidation,
  enhancedJWTAuth,
  createAdminController.getDeprecatedFieldsStatus
);

router.post(
  "/migration/migrate-deprecated-fields",
  adminValidations.migrateDeprecatedFields,
  adminValidations.validateProductionSafety,
  adminValidations.batchOperationValidation,
  enhancedJWTAuth,
  createAdminController.migrateDeprecatedFields
);

router.get(
  "/config/current",
  enhancedJWTAuth,
  createAdminController.getCurrentConfig
);

router.get("/docs", createAdminController.getDocs);

module.exports = router;
