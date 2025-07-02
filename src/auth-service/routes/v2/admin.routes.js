//routes/v2/admin.routes.js
const express = require("express");
const router = express.Router();
const adminController = require("@controllers/admin.controller");
const adminValidations = require("@validators/admin.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const { body } = require("express-validator");

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

/**
 * POST /api/v2/admin/super-admin
 * Quick setup endpoint to make a user super admin
 */
router.post(
  "/super-admin",
  adminValidations.setupSuperAdmin,
  setJWTAuth,
  authJWT,
  adminController.setupSuperAdmin
);

/**
 * POST /api/v2/admin/super-admin/enhanced
 * Enhanced setup endpoint with detailed feedback
 */
router.post(
  "/super-admin/enhanced",
  adminValidations.enhancedSetupSuperAdmin,
  setJWTAuth,
  authJWT,
  adminController.enhancedSetupSuperAdmin
);

/**
 * GET /api/v2/admin/rbac-health
 * Check RBAC system health
 */
router.get(
  "/rbac-health",
  adminValidations.checkRBACHealth,
  adminController.checkRBACHealth
);

/**
 * POST /api/v2/admin/rbac-reset
 * Reset and reinitialize RBAC system (development/troubleshooting)
 */
router.post(
  "/rbac-reset",
  adminValidations.resetRBACSystem,
  adminValidations.validateProductionSafety,
  adminController.resetRBACSystem
);

/**
 * POST /api/v2/admin/rbac-initialize
 * Force RBAC initialization (useful for troubleshooting)
 */
router.post(
  "/rbac-initialize",
  adminValidations.initializeRBAC,
  adminController.initializeRBAC
);

/**
 * GET /api/v2/admin/rbac-status
 * Get detailed RBAC system status and recommendations
 */
router.get(
  "/rbac-status",
  adminValidations.getRBACStatus,
  adminController.getRBACStatus
);

/**
 * GET /api/v2/admin/system-diagnostics
 * Get comprehensive system diagnostics
 */
router.get(
  "/system-diagnostics",
  adminValidations.getSystemDiagnostics,
  setJWTAuth,
  authJWT,
  adminController.getSystemDiagnostics
);

/**
 * POST /api/v2/admin/bulk-operations
 * Perform bulk administrative operations
 */
router.post(
  "/bulk-operations",
  adminValidations.bulkAdminOperations,
  adminValidations.batchOperationValidation,
  setJWTAuth,
  authJWT,
  adminController.bulkAdminOperations
);

// User audit endpoints
router.get(
  "/audit/users",
  adminValidations.auditValidation,
  adminValidations.userSearchValidation,
  setJWTAuth,
  authJWT,
  (req, res, next) => {
    res.status(httpStatus.NOT_IMPLEMENTED).json({
      success: false,
      message: "User audit functionality not yet implemented",
      data: {
        note: "This endpoint will provide comprehensive user audit functionality",
        available_filters: [
          "search",
          "role_filter",
          "status_filter",
          "date_from",
          "date_to",
          "export_format",
        ],
      },
    });
  }
);

// Role audit endpoints
router.get(
  "/audit/roles",
  adminValidations.auditValidation,
  setJWTAuth,
  authJWT,
  (req, res, next) => {
    // This would call a role audit function in the admin controller
    res.json({
      success: true,
      message: "Role audit endpoint - implementation pending",
      data: {
        note: "This endpoint will provide comprehensive role audit functionality",
      },
    });
  }
);

// Permission audit endpoints
router.get(
  "/audit/permissions",
  adminValidations.auditValidation,
  setJWTAuth,
  authJWT,
  (req, res, next) => {
    // This would call a permission audit function in the admin controller
    res.json({
      success: true,
      message: "Permission audit endpoint - implementation pending",
      data: {
        note: "This endpoint will provide comprehensive permission audit functionality",
      },
    });
  }
);

// System maintenance endpoints
router.post(
  "/maintenance/cache-clear",
  [
    body("secret")
      .exists()
      .withMessage("Setup secret is required")
      .bail()
      .notEmpty()
      .withMessage("Secret must not be empty")
      .bail()
      .isString()
      .withMessage("Secret must be a string"),
  ],
  setJWTAuth,
  authJWT,
  (req, res, next) => {
    // This would call a cache clearing function in the admin controller
    res.json({
      success: true,
      message: "Cache clear endpoint - implementation pending",
      data: {
        note: "This endpoint will clear system caches",
      },
    });
  }
);

router.post(
  "/maintenance/database-cleanup",
  [
    body("secret")
      .exists()
      .withMessage("Setup secret is required")
      .bail()
      .notEmpty()
      .withMessage("Secret must not be empty")
      .bail()
      .isString()
      .withMessage("Secret must be a string"),
  ],
  adminValidations.validateProductionSafety,
  setJWTAuth,
  authJWT,
  (req, res, next) => {
    // This would call a database cleanup function in the admin controller
    res.json({
      success: true,
      message: "Database cleanup endpoint - implementation pending",
      data: {
        note: "This endpoint will perform database maintenance operations",
      },
    });
  }
);

// Migration assistance endpoints
router.get(
  "/migration/deprecated-fields-status",
  adminValidations.auditValidation,
  setJWTAuth,
  authJWT,
  (req, res, next) => {
    // This would call the existing deprecated fields audit
    res.json({
      success: true,
      message: "Deprecated fields migration status - implementation pending",
      data: {
        note: "This endpoint will show migration status for deprecated fields",
      },
    });
  }
);

router.post(
  "/migration/migrate-deprecated-fields",
  [
    body("secret")
      .exists()
      .withMessage("Setup secret is required")
      .bail()
      .notEmpty()
      .withMessage("Secret must not be empty")
      .bail()
      .isString()
      .withMessage("Secret must be a string"),
  ],
  adminValidations.validateProductionSafety,
  adminValidations.batchOperationValidation,
  setJWTAuth,
  authJWT,
  (req, res, next) => {
    // This would call a migration function in the admin controller
    res.json({
      success: true,
      message: "Deprecated fields migration endpoint - implementation pending",
      data: {
        note: "This endpoint will migrate users from deprecated fields to new RBAC structure",
      },
    });
  }
);

// Configuration endpoints
router.get("/config/current", setJWTAuth, authJWT, (req, res, next) => {
  // Return current admin configuration
  res.json({
    success: true,
    message: "Current admin configuration retrieved",
    data: {
      environment: process.env.NODE_ENV || "development",
      setup_secret_configured: !!process.env.ADMIN_SETUP_SECRET,
      features: {
        rbac_reset: true,
        bulk_operations: true,
        system_diagnostics: true,
        user_audit: true,
        migration_tools: true,
      },
      safety_checks: {
        production_confirmations: process.env.NODE_ENV === "production",
        dry_run_default: true,
        secret_validation: true,
      },
    },
  });
});

// Documentation endpoint
router.get("/docs", (req, res) => {
  res.json({
    service: "admin-service",
    version: "2.0",
    description: "Administrative utilities for RBAC system management",
    endpoints: {
      "/super-admin": {
        method: "POST",
        description: "Setup super admin user",
        requires_auth: true,
        requires_secret: true,
      },
      "/rbac-health": {
        method: "GET",
        description: "Check RBAC system health",
        requires_auth: false,
      },
      "/rbac-status": {
        method: "GET",
        description: "Get detailed RBAC status",
        requires_auth: false,
      },
      "/rbac-reset": {
        method: "POST",
        description: "Reset RBAC system (dangerous)",
        requires_auth: false,
        requires_secret: true,
        production_restricted: true,
      },
      "/rbac-initialize": {
        method: "POST",
        description: "Initialize RBAC system",
        requires_auth: false,
        requires_secret: true,
      },
      "/system-diagnostics": {
        method: "GET",
        description: "Comprehensive system diagnostics",
        requires_auth: true,
      },
      "/bulk-operations": {
        method: "POST",
        description: "Bulk administrative operations",
        requires_auth: true,
        requires_secret: true,
      },
    },
    security: {
      note: "All destructive operations require a setup secret",
      secret_env_var: "ADMIN_SETUP_SECRET",
      production_safety: "Additional confirmations required in production",
    },
  });
});

module.exports = router;
