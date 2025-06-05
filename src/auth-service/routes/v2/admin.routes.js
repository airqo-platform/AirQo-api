// routes/v2/admin.routes.js
const express = require("express");
const router = express.Router();
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- admin-routes`);

const {
  createSuccessResponse,
  createErrorResponse,
  HttpError,
  createNotFoundResponse,
  handleResponse,
} = require("@utils/shared");

// SECURITY: Only enable this in development or with proper secret
const SETUP_SECRET = process.env.ADMIN_SETUP_SECRET || "your-secret-key-here";

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

/**
 * POST /api/v2/users/admin/super-admin
 * Quick setup endpoint to make a user super admin
 */
router.post("/super-admin", setJWTAuth, authJWT, async (req, res, next) => {
  try {
    const { user_id, secret, tenant = "airqo" } = req.body;
    const currentUser = req.user;

    // Security check
    if (secret !== SETUP_SECRET) {
      const result = createErrorResponse(
        new Error("Invalid setup secret"),
        "create",
        logger,
        "super admin assignment"
      );
      result.status = httpStatus.FORBIDDEN;
      return handleResponse(res, result, "data");
    }

    // Only allow in development or for current user
    if (
      process.env.NODE_ENV === "production" &&
      user_id !== currentUser._id.toString()
    ) {
      const result = createErrorResponse(
        new Error("Production setup only allowed for current user"),
        "create",
        logger,
        "super admin assignment"
      );
      result.status = httpStatus.FORBIDDEN;
      return handleResponse(res, result, "data");
    }

    const targetUserId = user_id || currentUser._id;

    // Use the robust ensureSuperAdminRole function
    const rolePermissionsUtil = require("@utils/role-permissions.util");
    let superAdminRole;

    try {
      superAdminRole = await rolePermissionsUtil.ensureSuperAdminRole(tenant);
    } catch (roleError) {
      logger.error("Failed to ensure super admin role:", roleError.message);

      // Fallback: try to find any existing role with SUPER_ADMIN in the name
      superAdminRole = await RoleModel(tenant).findOne({
        $or: [
          { role_name: { $regex: /SUPER_ADMIN/i } },
          { role_code: { $regex: /SUPER_ADMIN/i } },
        ],
      });

      if (!superAdminRole) {
        const result = createErrorResponse(
          new Error(
            "Could not create or find SUPER_ADMIN role. Please check logs and try running full RBAC setup first."
          ),
          "create",
          logger,
          "super admin role"
        );
        result.status = httpStatus.INTERNAL_SERVER_ERROR;
        result.suggestion =
          "Try POST /api/v2/users/admin/rbac-reset first, then retry this request";
        return handleResponse(res, result, "data");
      }
    }

    // Find AirQo organization
    const GroupModel = require("@models/Group");
    let airqoGroup = await GroupModel(tenant).findOne({
      grp_title: { $regex: /^airqo$/i },
    });

    if (!airqoGroup) {
      // Create AirQo group if it doesn't exist
      airqoGroup = await GroupModel(tenant).create({
        grp_title: "AirQo",
        grp_description: "AirQo Organization - System Administrator Group",
        grp_status: "ACTIVE",
        organization_slug: "airqo",
      });
    }

    // Check if user exists and their current role status
    const existingUser = await UserModel(tenant).findById(targetUserId).lean();
    if (!existingUser) {
      const result = createNotFoundResponse(
        "user",
        "find",
        `User ${targetUserId} not found`
      );
      return handleResponse(res, result, "data");
    }

    // Check if user already has super admin role
    const hasExistingRole = existingUser.group_roles?.some(
      (gr) => gr.role && gr.role.toString() === superAdminRole._id.toString()
    );

    if (hasExistingRole) {
      const result = createSuccessResponse(
        "find",
        {
          user_id: targetUserId,
          role_assigned: superAdminRole.role_name,
          role_id: superAdminRole._id,
          group: airqoGroup.grp_title,
          group_id: airqoGroup._id,
          tenant: tenant,
          status: "already_assigned",
          timestamp: new Date().toISOString(),
        },
        "super admin assignment",
        { message: "User already has SUPER_ADMIN role" }
      );
      return handleResponse(res, result, "data");
    }

    // Update user with super admin role
    const updatedUser = await UserModel(tenant).findByIdAndUpdate(
      targetUserId,
      {
        $addToSet: {
          group_roles: {
            group: airqoGroup._id,
            role: superAdminRole._id,
            userType: "admin",
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    );

    // Clear RBAC cache
    const RBACService = require("@services/rbac.service");
    const rbacService = new RBACService(tenant);
    rbacService.clearUserCache(targetUserId);

    const result = createSuccessResponse(
      "create",
      {
        user_id: targetUserId,
        role_assigned: superAdminRole.role_name,
        role_id: superAdminRole._id,
        group: airqoGroup.grp_title,
        group_id: airqoGroup._id,
        tenant: tenant,
        status: "newly_assigned",
        timestamp: new Date().toISOString(),
        next_steps: [
          "User now has super admin access",
          "Try accessing /api/v2/users/org-requests",
          "Check /api/v2/users/admin/rbac-health for system status",
        ],
      },
      "super admin assignment",
      { message: "User successfully assigned SUPER_ADMIN role" }
    );

    handleResponse(res, result, "data");
  } catch (error) {
    logger.error("Super admin setup error:", error);
    const result = createErrorResponse(
      error,
      "create",
      logger,
      "super admin assignment"
    );
    result.suggestion =
      "Check server logs for details. You may need to run RBAC reset first.";
    handleResponse(res, result, "data");
  }
});

/**
 * GET /api/v2/users/admin/rbac-health
 * Check RBAC system health
 */
router.get("/rbac-health", async (req, res) => {
  try {
    const { tenant = "airqo" } = req.query;

    const [permissionCount, roleCount, airqoRoles] = await Promise.all([
      PermissionModel(tenant).countDocuments(),
      RoleModel(tenant).countDocuments(),
      RoleModel(tenant).countDocuments({ role_name: { $regex: /^AIRQO_/ } }),
    ]);

    const isHealthy = permissionCount > 0 && roleCount > 0;
    const hasAirqoRoles = airqoRoles > 0;

    const healthData = {
      service: "rbac-system",
      status: isHealthy ? "healthy" : "unhealthy",
      permissions_count: permissionCount,
      roles_count: roleCount,
      airqo_roles_count: airqoRoles,
      has_airqo_roles: hasAirqoRoles,
      tenant: tenant,
      timestamp: new Date().toISOString(),
      recommendations: !isHealthy
        ? [
            "Run: POST /api/v2/users/admin/rbac-reset to reset and reinitialize",
            "Check database connectivity",
            "Verify permissions in logs",
          ]
        : [],
    };

    const result = createSuccessResponse(
      "find",
      healthData,
      "RBAC health status",
      {
        message: isHealthy
          ? "RBAC system is operational"
          : "RBAC system needs initialization",
      }
    );

    if (!isHealthy) {
      result.status = httpStatus.SERVICE_UNAVAILABLE;
    }

    handleResponse(res, result, "health_status");
  } catch (error) {
    const result = createErrorResponse(
      error,
      "find",
      logger,
      "RBAC health check"
    );
    handleResponse(res, result, "health_status");
  }
});

/**
 * POST /api/v2/users/admin/rbac-reset
 * Reset and reinitialize RBAC system (development/troubleshooting)
 */
router.post("/rbac-reset", async (req, res, next) => {
  try {
    const {
      secret,
      dry_run = true,
      reset_permissions = false,
      reset_roles = true,
      reset_user_roles = false,
      tenant = "airqo",
    } = req.body;

    // Security check
    if (secret !== SETUP_SECRET) {
      const result = createErrorResponse(
        new Error("Invalid setup secret"),
        "delete",
        logger,
        "RBAC reset"
      );
      result.status = httpStatus.FORBIDDEN;
      return handleResponse(res, result, "data");
    }

    // Only allow in development unless dry run
    if (process.env.NODE_ENV === "production" && !dry_run) {
      const result = createErrorResponse(
        new Error("RBAC reset not allowed in production without dry_run=true"),
        "delete",
        logger,
        "RBAC reset"
      );
      result.status = httpStatus.FORBIDDEN;
      return handleResponse(res, result, "data");
    }

    // Import reset utility
    const rolePermissionsUtil = require("@utils/role-permissions.util");

    // Reset RBAC data
    const resetResult = await rolePermissionsUtil.resetRBACData(tenant, {
      resetPermissions: reset_permissions,
      resetRoles: reset_roles,
      resetUserRoles: reset_user_roles,
      dryRun: dry_run,
    });

    if (!dry_run) {
      // Re-initialize after reset
      setTimeout(async () => {
        try {
          await rolePermissionsUtil.setupDefaultPermissions(tenant);
          logger.info("✅ RBAC re-initialized after reset");
        } catch (error) {
          logger.error(
            "❌ Error re-initializing RBAC after reset:",
            error.message
          );
        }
      }, 2000);
    }

    const result = createSuccessResponse(
      "delete",
      {
        reset_results: resetResult.data,
        dry_run: dry_run,
        next_steps: dry_run
          ? [
              "Review the results above",
              "Set dry_run=false to perform actual reset",
              "System will auto-reinitialize after reset",
            ]
          : [
              "RBAC data has been reset",
              "System is re-initializing default permissions and roles",
              "Check /api/v2/users/admin/rbac-health in a few seconds",
            ],
      },
      "RBAC reset",
      {
        message: `RBAC reset ${dry_run ? "(dry run) " : ""}completed`,
      }
    );

    handleResponse(res, result, "reset_results");
  } catch (error) {
    const result = createErrorResponse(error, "delete", logger, "RBAC reset");
    handleResponse(res, result, "reset_results");
  }
});

/**
 * POST /api/v2/users/admin/rbac-initialize
 * Force RBAC initialization (useful for troubleshooting)
 */
router.post("/rbac-initialize", async (req, res, next) => {
  try {
    const { secret, tenant = "airqo", force = false } = req.body;

    // Security check
    if (secret !== SETUP_SECRET) {
      const result = createErrorResponse(
        new Error("Invalid setup secret"),
        "create",
        logger,
        "RBAC initialization"
      );
      result.status = httpStatus.FORBIDDEN;
      return handleResponse(res, result, "data");
    }

    const rolePermissionsUtil = require("@utils/role-permissions.util");

    // Check current state if not forcing
    let currentState = {};
    if (!force) {
      const [permissionCount, roleCount] = await Promise.all([
        PermissionModel(tenant).countDocuments(),
        RoleModel(tenant).countDocuments({ role_name: { $regex: /^AIRQO_/ } }),
      ]);

      currentState = { permissionCount, roleCount };

      if (permissionCount > 0 && roleCount > 0) {
        const result = createSuccessResponse(
          "find",
          {
            message: "RBAC already initialized",
            current_state: currentState,
            suggestion: "Use force=true to reinitialize anyway",
          },
          "RBAC initialization",
          { message: "RBAC system already appears to be initialized" }
        );
        return handleResponse(res, result, "initialization_status");
      }
    }

    // Run initialization
    const initResult = await rolePermissionsUtil.setupDefaultPermissions(
      tenant
    );

    const result = createSuccessResponse(
      "create",
      {
        initialization_results: initResult.data,
        forced: force,
        previous_state: currentState,
        next_steps: [
          "Check /api/v2/users/admin/rbac-health to verify system status",
          "Use POST /api/v2/users/admin/super-admin to assign super admin role",
          "Test access to protected endpoints",
        ],
      },
      "RBAC initialization",
      { message: initResult.message }
    );

    if (!initResult.success) {
      result.success = false;
      result.status = httpStatus.INTERNAL_SERVER_ERROR;
    }

    handleResponse(res, result, "initialization_status");
  } catch (error) {
    const result = createErrorResponse(
      error,
      "create",
      logger,
      "RBAC initialization"
    );
    handleResponse(res, result, "initialization_status");
  }
});

/**
 * GET /api/v2/users/admin/rbac-status
 * Get detailed RBAC system status and recommendations
 */
router.get("/rbac-status", async (req, res) => {
  try {
    const { tenant = "airqo" } = req.query;

    // Get comprehensive status
    const [
      permissionCount,
      roleCount,
      airqoRoles,
      superAdminRole,
      usersWithRoles,
      totalUsers,
    ] = await Promise.all([
      PermissionModel(tenant).countDocuments(),
      RoleModel(tenant).countDocuments(),
      RoleModel(tenant)
        .find({ role_name: { $regex: /^AIRQO_/ } })
        .lean(),
      RoleModel(tenant).findOne({ role_code: "AIRQO_SUPER_ADMIN" }).lean(),
      UserModel(tenant).countDocuments({
        $or: [
          { "group_roles.0": { $exists: true } },
          { "network_roles.0": { $exists: true } },
        ],
      }),
      UserModel(tenant).countDocuments(),
    ]);

    const isHealthy = permissionCount > 0 && roleCount > 0 && superAdminRole;
    const roleAssignmentCoverage =
      totalUsers > 0 ? Math.round((usersWithRoles / totalUsers) * 100) : 0;

    const statusData = {
      system_health: {
        status: isHealthy ? "healthy" : "needs_attention",
        permissions_count: permissionCount,
        total_roles_count: roleCount,
        airqo_roles_count: airqoRoles.length,
        super_admin_role_exists: !!superAdminRole,
      },
      user_coverage: {
        total_users: totalUsers,
        users_with_roles: usersWithRoles,
        coverage_percentage: roleAssignmentCoverage,
        status:
          roleAssignmentCoverage > 80
            ? "good"
            : roleAssignmentCoverage > 50
            ? "fair"
            : "poor",
      },
      airqo_roles: airqoRoles.map((role) => ({
        id: role._id,
        name: role.role_name,
        code: role.role_code,
        permissions_count: role.role_permissions?.length || 0,
      })),
      recommendations: [],
    };

    // Generate recommendations
    if (!isHealthy) {
      statusData.recommendations.push(
        "Initialize RBAC system using POST /api/v2/users/admin/rbac-initialize"
      );
    }

    if (!superAdminRole) {
      statusData.recommendations.push(
        "Create super admin role using POST /api/v2/users/admin/super-admin"
      );
    }

    if (roleAssignmentCoverage < 50) {
      statusData.recommendations.push(
        "Review user role assignments - many users lack proper roles"
      );
    }

    if (statusData.recommendations.length === 0) {
      statusData.recommendations.push("RBAC system is functioning well");
    }

    const result = createSuccessResponse(
      "find",
      statusData,
      "RBAC system status",
      { message: "RBAC system status retrieved successfully" }
    );

    handleResponse(res, result, "rbac_status");
  } catch (error) {
    const result = createErrorResponse(
      error,
      "find",
      logger,
      "RBAC system status"
    );
    handleResponse(res, result, "rbac_status");
  }
});

module.exports = router;
