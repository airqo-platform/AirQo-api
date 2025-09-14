// admin.util.js
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const ObjectId = require("mongoose").Types.ObjectId;
const mongoose = require("mongoose");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- admin-util`);

const SETUP_SECRET = constants.ADMIN_SETUP_SECRET;

// Helper function to validate setup secret
const validateSetupSecret = (secret) => {
  return secret === SETUP_SECRET;
};

// Helper function to check if operation is allowed in production
const isProductionOperationAllowed = (operation, userId, currentUserId) => {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return userId === currentUserId?.toString();
};

// Helper function to calculate health score
const calculateHealthScore = (diagnostics) => {
  let score = 100;

  if (diagnostics.basic_health.status !== "healthy") score -= 30;
  if (!diagnostics.detailed_status.system_health.super_admin_role_exists)
    score -= 20;
  if (diagnostics.detailed_status.user_coverage.coverage_percentage < 50)
    score -= 20;
  if (diagnostics.detailed_status.system_health.permissions_count === 0)
    score -= 30;

  return Math.max(0, score);
};

// Helper function to get health grade
const getHealthGrade = (score) => {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
};

const admin = {
  setupSuperAdmin: async (request, next) => {
    try {
      const { user_id, secret, tenant } = { ...request.body, ...request.query };
      const currentUser = request.user;

      logObject("setupSuperAdmin request:", {
        user_id,
        tenant,
        hasSecret: !!secret,
      });

      if (!validateSetupSecret(secret)) {
        return {
          success: false,
          message: "Invalid setup secret",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Authentication failed" },
        };
      }

      if (
        !isProductionOperationAllowed("super-admin", user_id, currentUser?._id)
      ) {
        return {
          success: false,
          message: "Production setup only allowed for current user",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Operation not permitted in production" },
        };
      }

      const targetUserId = user_id || currentUser._id;

      const rolePermissionsUtil = require("@utils/role-permissions.util");
      let superAdminRole;

      try {
        superAdminRole = await rolePermissionsUtil.ensureSuperAdminRole(tenant);
      } catch (roleError) {
        logger.error("Failed to ensure super admin role:", roleError.message);

        superAdminRole = await RoleModel(tenant).findOne({
          $or: [
            { role_name: { $regex: /SUPER_ADMIN/i } },
            { role_code: { $regex: /SUPER_ADMIN/i } },
          ],
        });

        if (!superAdminRole) {
          return {
            success: false,
            message:
              "Could not create or find SUPER_ADMIN role. Please check logs and try running full RBAC setup first.",
            status: httpStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message: "SUPER_ADMIN role creation failed",
              suggestion:
                "Try POST /api/v2/admin/rbac-reset first, then retry this request",
            },
          };
        }
      }

      let airqoGroup = await GroupModel(tenant).findOne({
        grp_title: { $regex: /^airqo$/i },
      });

      if (!airqoGroup) {
        airqoGroup = await GroupModel(tenant).create({
          grp_title: "AirQo",
          grp_description: "AirQo Organization - System Administrator Group",
          grp_status: "ACTIVE",
          organization_slug: "airqo",
        });
      }

      const existingUser = await UserModel(tenant)
        .findById(targetUserId)
        .lean();
      if (!existingUser) {
        return {
          success: false,
          message: `User ${targetUserId} not found`,
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      // Atomically update the user's roles for the AirQo group.
      // This operation ensures the user ends up with just the SUPER_ADMIN role for this group,
      // replacing any other role they might have had for the AirQo group.
      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        targetUserId,
        [
          {
            $set: {
              group_roles: {
                $concatArrays: [
                  // 1. Filter out any existing role for the airqoGroup
                  {
                    $filter: {
                      input: { $ifNull: ["$group_roles", []] },
                      as: "role",
                      cond: { $ne: ["$$role.group", airqoGroup._id] },
                    },
                  },
                  // 2. Add the new SUPER_ADMIN role
                  [
                    {
                      group: airqoGroup._id,
                      role: superAdminRole._id,
                      userType: "admin",
                      createdAt: new Date(),
                    },
                  ],
                ],
              },
            },
          },
        ],
        { new: true }
      );

      if (!updatedUser) {
        throw new HttpError("User update failed", 500, {
          message: "Failed to assign SUPER_ADMIN role.",
        });
      }

      // Clear the user's permissions cache to reflect the changes immediately
      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      rbacService.clearUserCache(targetUserId);

      return {
        success: true,
        message: "User role successfully updated to SUPER_ADMIN",
        status: httpStatus.OK,
        data: {
          user_id: targetUserId,
          role_assigned: superAdminRole.role_name,
          role_id: superAdminRole._id,
          group: airqoGroup.grp_title,
          group_id: airqoGroup._id,
          tenant: tenant,
          status: "role_updated",
          timestamp: new Date().toISOString(),
          next_steps: [
            "User now has super admin access",
            "Try accessing /api/v2/org-requests",
            "Check /api/v2/admin/rbac-health for system status",
          ],
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  enhancedSetupSuperAdmin: async (request, next) => {
    try {
      const { user_id, secret, tenant } = { ...request.body, ...request.query };
      const currentUser = request.user;

      logObject("enhancedSetupSuperAdmin request:", {
        user_id,
        tenant,
        hasSecret: !!secret,
      });

      const initialUser = user_id
        ? await UserModel(tenant).findById(user_id).lean()
        : await UserModel(tenant).findById(currentUser._id).lean();

      if (!initialUser) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Target user does not exist" },
        };
      }

      const setupResult = await admin.setupSuperAdmin(request, next);

      if (!setupResult.success) {
        return setupResult;
      }

      const updatedUser = await UserModel(tenant)
        .findById(setupResult.data.user_id)
        .lean();

      return {
        success: true,
        message: setupResult.message,
        operation: "enhanced_super_admin_setup",
        setup_details: {
          user_id: setupResult.data.user_id,
          role_assigned: setupResult.data.role_assigned,
          tenant: setupResult.data.tenant,
          operation_timestamp: setupResult.data.timestamp,
        },
        before_setup: {
          user_email: initialUser.email,
          group_roles_count: initialUser.group_roles?.length || 0,
          network_roles_count: initialUser.network_roles?.length || 0,
        },
        after_setup: {
          user_email: updatedUser.email,
          group_roles_count: updatedUser.group_roles?.length || 0,
          network_roles_count: updatedUser.network_roles?.length || 0,
          is_super_admin: updatedUser.group_roles?.some(
            (gr) =>
              gr.role &&
              gr.role.toString() === setupResult.data.role_id.toString()
          ),
        },
        status: setupResult.status,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  checkRBACHealth: async (request, next) => {
    try {
      const { tenant } = request.query;

      logObject("checkRBACHealth for tenant:", tenant);

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
              "Run: POST /api/v2/admin/rbac-reset to reset and reinitialize",
              "Check database connectivity",
              "Verify permissions in logs",
            ]
          : [],
      };

      return {
        success: true,
        message: isHealthy
          ? "RBAC system is operational"
          : "RBAC system needs initialization",
        status: isHealthy ? httpStatus.OK : httpStatus.SERVICE_UNAVAILABLE,
        data: healthData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  resetRBACSystem: async (request, next) => {
    try {
      const {
        secret,
        dry_run = true,
        reset_permissions = false,
        reset_roles = true,
        reset_user_roles = false,
        tenant,
      } = { ...request.body, ...request.query };

      logObject("resetRBACSystem request:", {
        tenant,
        dry_run,
        reset_permissions,
        reset_roles,
        reset_user_roles,
        hasSecret: !!secret,
      });

      if (!validateSetupSecret(secret)) {
        return {
          success: false,
          message: "Invalid setup secret",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Authentication failed" },
        };
      }

      if (process.env.NODE_ENV === "production" && !dry_run) {
        return {
          success: false,
          message: "RBAC reset not allowed in production without dry_run=true",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Production safety check failed" },
        };
      }

      const rolePermissionsUtil = require("@utils/role-permissions.util");

      const resetResult = await rolePermissionsUtil.resetRBACData(tenant, {
        resetPermissions: reset_permissions,
        resetRoles: reset_roles,
        resetUserRoles: reset_user_roles,
        dryRun: dry_run,
      });

      if (!dry_run) {
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

      return {
        success: true,
        message: `RBAC reset ${dry_run ? "(dry run) " : ""}completed`,
        status: httpStatus.OK,
        data: {
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
                "Check /api/v2/admin/rbac-health in a few seconds",
              ],
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  initializeRBAC: async (request, next) => {
    try {
      const {
        secret,
        tenant,
        force = false,
      } = { ...request.body, ...request.query };

      logObject("initializeRBAC request:", {
        tenant,
        force,
        hasSecret: !!secret,
      });

      if (!validateSetupSecret(secret)) {
        return {
          success: false,
          message: "Invalid setup secret",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Authentication failed" },
        };
      }

      const rolePermissionsUtil = require("@utils/role-permissions.util");

      let currentState = {};
      if (!force) {
        const [permissionCount, roleCount] = await Promise.all([
          PermissionModel(tenant).countDocuments(),
          RoleModel(tenant).countDocuments({
            role_name: { $regex: /^AIRQO_/ },
          }),
        ]);

        currentState = { permissionCount, roleCount };

        if (permissionCount > 0 && roleCount > 0) {
          return {
            success: true,
            message: "RBAC system already appears to be initialized",
            status: httpStatus.OK,
            data: {
              message: "RBAC already initialized",
              current_state: currentState,
              suggestion: "Use force=true to reinitialize anyway",
            },
          };
        }
      }

      const initResult = await rolePermissionsUtil.setupDefaultPermissions(
        tenant
      );

      return {
        success: initResult.success,
        message: initResult.message,
        status: initResult.success
          ? httpStatus.OK
          : httpStatus.INTERNAL_SERVER_ERROR,
        data: {
          initialization_results: initResult.data,
          forced: force,
          previous_state: currentState,
          next_steps: [
            "Check /api/v2/admin/rbac-health to verify system status",
            "Use POST /api/v2/admin/super-admin to assign super admin role",
            "Test access to protected endpoints",
          ],
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getRBACStatus: async (request, next) => {
    try {
      const { tenant } = request.query;

      logObject("getRBACStatus for tenant:", tenant);

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

      if (!isHealthy) {
        statusData.recommendations.push(
          "Initialize RBAC system using POST /api/v2/admin/rbac-initialize"
        );
      }

      if (!superAdminRole) {
        statusData.recommendations.push(
          "Create super admin role using POST /api/v2/admin/super-admin"
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

      return {
        success: true,
        message: "RBAC system status retrieved successfully",
        status: httpStatus.OK,
        data: statusData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getSystemDiagnostics: async (request, next) => {
    try {
      const { tenant, include_users = false } = request.query;

      logObject("getSystemDiagnostics for tenant:", tenant);

      const healthResult = await admin.checkRBACHealth(request, next);
      const statusResult = await admin.getRBACStatus(request, next);

      const diagnostics = {
        timestamp: new Date().toISOString(),
        tenant: tenant,
        environment: process.env.NODE_ENV || "development",
        basic_health: healthResult.data,
        detailed_status: statusResult.data,
        database_connectivity: "operational",
        cache_status: "operational",
      };

      if (include_users === "true") {
        const usersWithDeprecatedFields = await UserModel(
          tenant
        ).countDocuments({
          $or: [
            { role: { $exists: true, $ne: null } },
            { privilege: { $exists: true, $ne: null } },
            { organization: { $exists: true, $ne: null } },
          ],
        });

        diagnostics.user_analysis = {
          users_with_deprecated_fields: usersWithDeprecatedFields,
          migration_needed: usersWithDeprecatedFields > 0,
        };
      }

      const healthScore = calculateHealthScore(diagnostics);
      diagnostics.overall_health = {
        score: healthScore,
        grade: getHealthGrade(healthScore),
        critical_issues:
          healthScore < 70 ? ["System requires immediate attention"] : [],
      };

      return {
        success: true,
        message: "System diagnostics completed successfully",
        status: httpStatus.OK,
        data: diagnostics,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  bulkAdminOperations: async (request, next) => {
    try {
      const { operation, user_ids, secret, tenant } = request.body;

      logObject("bulkAdminOperations request:", {
        operation,
        userCount: user_ids?.length,
        tenant,
      });

      if (!validateSetupSecret(secret)) {
        return {
          success: false,
          message: "Invalid setup secret",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Authentication failed" },
        };
      }

      if (
        !["setup_super_admin", "remove_super_admin", "audit_users"].includes(
          operation
        )
      ) {
        return {
          success: false,
          message: "Invalid operation",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "Operation must be one of: setup_super_admin, remove_super_admin, audit_users",
          },
        };
      }

      const results = {
        operation,
        total_users: user_ids?.length || 0,
        successful: 0,
        failed: 0,
        errors: [],
        details: [],
      };

      if (operation === "audit_users") {
        for (const userId of user_ids || []) {
          try {
            const user = await UserModel(tenant).findById(userId).lean();
            if (user) {
              results.successful++;
              results.details.push({
                user_id: userId,
                email: user.email,
                status: "audited",
                has_roles: !!(
                  user.group_roles?.length || user.network_roles?.length
                ),
                deprecated_fields: {
                  role: !!user.role,
                  privilege: !!user.privilege,
                  organization: !!user.organization,
                },
              });
            } else {
              results.failed++;
              results.errors.push({
                user_id: userId,
                error: "User not found",
              });
            }
          } catch (error) {
            results.failed++;
            results.errors.push({
              user_id: userId,
              error: error.message,
            });
          }
        }
      } else {
        for (const userId of user_ids || []) {
          try {
            let operationResult;
            const operationRequest = {
              ...request,
              body: { ...request.body, user_id: userId },
              query: { ...request.query, tenant },
            };

            if (operation === "setup_super_admin") {
              operationResult = await admin.setupSuperAdmin(
                operationRequest,
                next
              );
            } else if (operation === "remove_super_admin") {
              operationResult = {
                success: false,
                message: "Remove super admin operation not yet implemented",
              };
            }

            if (operationResult && operationResult.success) {
              results.successful++;
              results.details.push({
                user_id: userId,
                status: "success",
                operation,
              });
            } else {
              results.failed++;
              results.errors.push({
                user_id: userId,
                error: operationResult?.message || "Unknown error",
              });
            }
          } catch (error) {
            results.failed++;
            results.errors.push({
              user_id: userId,
              error: error.message,
            });
          }
        }
      }

      return {
        success: results.failed === 0,
        message: `Bulk ${operation} operation completed`,
        status:
          results.failed === 0 ? httpStatus.OK : httpStatus.PARTIAL_CONTENT,
        data: results,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  auditUsers: async (request, next) => {
    try {
      const { tenant, limit, skip } = { ...request.query };
      const filter = generateFilter.admin(request, next);

      const responseFromListUsers = await UserModel(tenant.toLowerCase()).list(
        { skip, limit, filter },
        next
      );

      if (responseFromListUsers.success === true) {
        const auditData = responseFromListUsers.data.map((user) => ({
          user_id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          has_group_roles: !!(user.group_roles && user.group_roles.length > 0),
          has_network_roles: !!(
            user.network_roles && user.network_roles.length > 0
          ),
          deprecated_fields: {
            role: !!user.role,
            privilege: !!user.privilege,
            organization: !!user.organization,
          },
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        }));

        return {
          success: true,
          message: "User audit completed successfully",
          status: httpStatus.OK,
          data: auditData,
        };
      } else {
        return responseFromListUsers;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  auditRoles: async (request, next) => {
    try {
      const { tenant, limit, skip } = { ...request.query };
      const filter = generateFilter.admin(request, next);

      const responseFromListRoles = await RoleModel(tenant.toLowerCase()).list(
        { skip, limit, filter },
        next
      );

      if (responseFromListRoles.success === true) {
        const auditData = responseFromListRoles.data.map((role) => ({
          role_id: role._id,
          role_name: role.role_name,
          role_code: role.role_code,
          permissions_count: role.role_permissions?.length || 0,
          role_status: role.role_status,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        }));

        return {
          success: true,
          message: "Role audit completed successfully",
          status: httpStatus.OK,
          data: auditData,
        };
      } else {
        return responseFromListRoles;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  auditPermissions: async (request, next) => {
    try {
      const { tenant, limit, skip } = { ...request.query };
      const filter = generateFilter.admin(request, next);

      const responseFromListPermissions = await PermissionModel(
        tenant.toLowerCase()
      ).list({ skip, limit, filter }, next);

      if (responseFromListPermissions.success === true) {
        const auditData = responseFromListPermissions.data.map(
          (permission) => ({
            permission_id: permission._id,
            permission: permission.permission,
            resource: permission.resource,
            operation: permission.operation,
            description: permission.description,
            createdAt: permission.createdAt,
            updatedAt: permission.updatedAt,
          })
        );

        return {
          success: true,
          message: "Permission audit completed successfully",
          status: httpStatus.OK,
          data: auditData,
        };
      } else {
        return responseFromListPermissions;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  clearCache: async (request, next) => {
    try {
      const { secret, tenant } = { ...request.body, ...request.query };

      if (!validateSetupSecret(secret)) {
        return {
          success: false,
          message: "Invalid setup secret",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Authentication failed" },
        };
      }

      const RBACService = require("@services/rbac.service");
      const rbacService = new RBACService(tenant);
      await rbacService.clearAllCache();

      return {
        success: true,
        message: "Cache cleared successfully",
        status: httpStatus.OK,
        data: {
          operation: "cache_clear",
          tenant: tenant,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  databaseCleanup: async (request, next) => {
    try {
      const { secret, tenant } = { ...request.body, ...request.query };

      if (!validateSetupSecret(secret)) {
        return {
          success: false,
          message: "Invalid setup secret",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Authentication failed" },
        };
      }

      return {
        success: true,
        message: "Database cleanup completed successfully",
        status: httpStatus.OK,
        data: {
          operation: "database_cleanup",
          tenant: tenant,
          timestamp: new Date().toISOString(),
          note: "Database cleanup functionality implementation pending",
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getDeprecatedFieldsStatus: async (request, next) => {
    try {
      const { tenant } = request.query;

      const usersWithDeprecatedFields = await UserModel(tenant).aggregate([
        {
          $match: {
            $or: [
              { role: { $exists: true, $ne: null } },
              { privilege: { $exists: true, $ne: null } },
              { organization: { $exists: true, $ne: null } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            total_users_with_deprecated_fields: { $sum: 1 },
            users_with_role_field: {
              $sum: {
                $cond: [{ $ne: ["$role", null] }, 1, 0],
              },
            },
            users_with_privilege_field: {
              $sum: {
                $cond: [{ $ne: ["$privilege", null] }, 1, 0],
              },
            },
            users_with_organization_field: {
              $sum: {
                $cond: [{ $ne: ["$organization", null] }, 1, 0],
              },
            },
          },
        },
      ]);

      const migrationStatus = {
        migration_needed: usersWithDeprecatedFields.length > 0,
        summary: usersWithDeprecatedFields[0] || {
          total_users_with_deprecated_fields: 0,
          users_with_role_field: 0,
          users_with_privilege_field: 0,
          users_with_organization_field: 0,
        },
        tenant: tenant,
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        message: "Deprecated fields status retrieved successfully",
        status: httpStatus.OK,
        data: migrationStatus,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  migrateDeprecatedFields: async (request, next) => {
    try {
      const { secret, tenant } = { ...request.body, ...request.query };

      if (!validateSetupSecret(secret)) {
        return {
          success: false,
          message: "Invalid setup secret",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Authentication failed" },
        };
      }

      return {
        success: true,
        message: "Deprecated fields migration completed successfully",
        status: httpStatus.OK,
        data: {
          operation: "migrate_deprecated_fields",
          tenant: tenant,
          timestamp: new Date().toISOString(),
          note: "Migration functionality implementation pending",
        },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getCurrentConfig: async (request, next) => {
    try {
      const configData = {
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
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        message: "Current admin configuration retrieved",
        status: httpStatus.OK,
        data: configData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  dropIndex: async (request, next) => {
    try {
      const { collectionName, indexName, secret, confirm } = request.body;
      const { tenant } = request.query;

      if (!validateSetupSecret(secret)) {
        return {
          success: false,
          message: "Invalid setup secret",
          status: httpStatus.FORBIDDEN,
          errors: { message: "Authentication failed" },
        };
      }

      if (!collectionName || !indexName) {
        return {
          success: false,
          message:
            "collectionName and indexName are required in the request body",
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (
        typeof collectionName !== "string" ||
        typeof indexName !== "string" ||
        !collectionName.trim() ||
        !indexName.trim()
      ) {
        return {
          success: false,
          message: "collectionName and indexName must be non-empty strings",
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (process.env.NODE_ENV === "production" && confirm !== "DROP_INDEX") {
        return {
          success: false,
          message:
            "Destructive operation requires confirm=DROP_INDEX in production",
          status: httpStatus.FORBIDDEN,
        };
      }

      // Get the tenant-specific database connection from an existing model
      const tenantDbConnection = UserModel(tenant).db;
      if (!tenantDbConnection) {
        throw new Error(
          `Could not get database connection for tenant: ${tenant}`
        );
      }
      const db = tenantDbConnection.db;
      const collections = await db.listCollections().toArray();
      const collectionExists = collections.some(
        (c) => c.name === collectionName
      );

      if (!collectionExists) {
        return {
          success: false,
          message: `Collection '${collectionName}' not found.`,
          status: httpStatus.NOT_FOUND,
        };
      }

      const collection = db.collection(collectionName);
      const indexExists = await collection.indexExists(indexName);

      if (!indexExists) {
        const allIndexes = await collection.indexes();
        return {
          success: false,
          message: `Index '${indexName}' does not exist on collection '${collectionName}'.`,
          status: httpStatus.NOT_FOUND,
          data: { availableIndexes: allIndexes.map((i) => i.name) },
        };
      }

      logger.warn(
        `[DB INDEX DROP] tenant=${tenant} collection=${collectionName} index=${indexName} actor=${
          request.user?.email || request.user?._id
        }`
      );
      const result = await collection.dropIndex(indexName);

      if (result) {
        return {
          success: true,
          message: `Successfully dropped index '${indexName}' from collection '${collectionName}'.`,
          status: httpStatus.OK,
        };
      } else {
        throw new Error(
          "Index drop operation failed to return a success status."
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Error dropping index: ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  getDocs: async (request, next) => {
    try {
      const docsData = {
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
      };

      return {
        success: true,
        message: "Admin service documentation retrieved",
        data: docsData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = admin;
