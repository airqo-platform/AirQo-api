// admin.routes.js
const express = require("express");
const router = express.Router();
const createAdminController = require("@controllers/admin.controller");
const adminValidations = require("@validators/admin.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
  setJWTAuth,
  authJWT,
  createAdminController.setupSuperAdmin
);

router.post(
  "/super-admin/enhanced",
  adminValidations.enhancedSetupSuperAdmin,
  setJWTAuth,
  authJWT,
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
  setJWTAuth,
  authJWT,
  createAdminController.getSystemDiagnostics
);

router.post(
  "/bulk-operations",
  adminValidations.bulkAdminOperations,
  adminValidations.batchOperationValidation,
  setJWTAuth,
  authJWT,
  createAdminController.bulkAdminOperations
);

router.get(
  "/audit/users",
  adminValidations.auditValidation,
  adminValidations.userSearchValidation,
  setJWTAuth,
  authJWT,
  createAdminController.auditUsers
);

router.get(
  "/audit/roles",
  adminValidations.auditValidation,
  setJWTAuth,
  authJWT,
  createAdminController.auditRoles
);

router.get(
  "/audit/permissions",
  adminValidations.auditValidation,
  setJWTAuth,
  authJWT,
  createAdminController.auditPermissions
);

router.post(
  "/maintenance/cache-clear",
  adminValidations.cacheManagement,
  setJWTAuth,
  authJWT,
  createAdminController.clearCache
);

router.post(
  "/maintenance/database-cleanup",
  adminValidations.databaseCleanup,
  adminValidations.validateProductionSafety,
  setJWTAuth,
  authJWT,
  createAdminController.databaseCleanup
);

router.get(
  "/migration/deprecated-fields-status",
  adminValidations.auditValidation,
  setJWTAuth,
  authJWT,
  createAdminController.getDeprecatedFieldsStatus
);

router.post(
  "/migration/migrate-deprecated-fields",
  adminValidations.migrateDeprecatedFields,
  adminValidations.validateProductionSafety,
  adminValidations.batchOperationValidation,
  setJWTAuth,
  authJWT,
  createAdminController.migrateDeprecatedFields
);

router.get(
  "/config/current",
  setJWTAuth,
  authJWT,
  createAdminController.getCurrentConfig
);

router.get("/docs", createAdminController.getDocs);

module.exports = router;
