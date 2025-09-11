// middleware/adminAccess.js
const httpStatus = require("http-status");
const RoleModel = require("@models/Role");
const GroupModel = require("@models/Group");
const PermissionModel = require("@models/Permission");
const { HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const RBACService = require("@services/rbac.service");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- admin-access`
);

const __rbacInstances = new Map();
const getRBACService = (tenant = constants.DEFAULT_TENANT) => {
  if (!__rbacInstances.has(tenant)) {
    const inst = new RBACService(tenant);
    // Unref the timer so it doesn't hold the event loop open
    if (
      inst.cleanupInterval &&
      typeof inst.cleanupInterval.unref === "function"
    ) {
      inst.cleanupInterval.unref();
    }
    __rbacInstances.set(tenant, inst);
  }
  return __rbacInstances.get(tenant);
};

/**
 * Enhanced admin access middleware that replaces the old adminCheck
 * Supports multiple identification methods and flexible permission checking
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
const adminCheck = (options = {}) => {
  const {
    contextType = "group", // 'group' or 'network'
    idParam = "grp_id", // Parameter name for context ID
    fallbackIdParams = ["groupSlug", "grp_slug"], // Alternative parameter names
    requireSuperAdmin = true, // Whether to require SUPER_ADMIN role
    allowedRoles = ["SUPER_ADMIN"], // Roles that grant access
    requiredPermissions = ["GROUP_MANAGEMENT"], // Required permissions
    useGroupTitle = false, // Whether to lookup by grp_title instead of _id
  } = options;

  return async (req, res, next) => {
    try {
      const { user } = req;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT || "airqo";

      if (!user) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Authentication required",
          })
        );
      }

      // Extract context ID from various possible sources
      let contextId =
        req.params[idParam] || req.query[idParam] || req.body[idParam];

      // Try fallback parameters
      if (!contextId) {
        for (const fallbackParam of fallbackIdParams) {
          contextId =
            req.params[fallbackParam] ||
            req.query[fallbackParam] ||
            req.body[fallbackParam];
          if (contextId) break;
        }
      }

      if (!contextId) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: `${contextType} identifier required`,
          })
        );
      }

      const rbacService = getRBACService(tenant);

      // Always allow the system-wide super admin
      const isSystemSuperAdmin = await rbacService.hasRole(user._id, [
        "AIRQO_SUPER_ADMIN",
      ]);
      if (isSystemSuperAdmin) return next();

      // Find the target group/network
      let targetContext;
      if (contextType === "group") {
        let lookupQuery = {};
        if (useGroupTitle) {
          lookupQuery["grp_title"] = contextId;
        } else if (mongoose.Types.ObjectId.isValid(contextId)) {
          lookupQuery["_id"] = contextId;
        } else {
          lookupQuery["$or"] = [
            { grp_slug: contextId },
            { organization_slug: contextId },
          ];
        }
        targetContext = await GroupModel(tenant).findOne(lookupQuery).lean();
      } else {
        // Add network lookup logic here when NetworkModel is available
        return next(
          new HttpError("Not Implemented", httpStatus.NOT_IMPLEMENTED, {
            message: "Network context not yet implemented",
          })
        );
      }

      if (!targetContext) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: `${contextType} ${contextId} not found`,
          })
        );
      }

      // Check if user is a member of this context
      const isMember =
        contextType === "group"
          ? await rbacService.isGroupMember(user._id, targetContext._id)
          : await rbacService.isNetworkMember(user._id, targetContext._id);

      if (!isMember) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: `You do not have access to this ${contextType}`,
          })
        );
      }

      // Check for super admin role in this context
      const isSuperAdminInContext = await rbacService.isSuperAdminInContext(
        user._id,
        targetContext._id,
        contextType
      );

      // Check for allowed roles
      const hasAllowedRole = await rbacService.hasRole(
        user._id,
        allowedRoles,
        targetContext._id,
        contextType
      );

      // Check for required permissions
      const hasRequiredPermissions = await rbacService.hasPermission(
        user._id,
        requiredPermissions,
        true, // require all permissions
        targetContext._id,
        contextType
      );

      // Determine if access should be granted
      let accessGranted = false;
      let accessReason = "";

      if (requireSuperAdmin && isSuperAdminInContext) {
        accessGranted = true; // This now refers to the org-specific super admin
        accessReason = "Organization super admin";
      } else if (
        !requireSuperAdmin &&
        (hasAllowedRole || hasRequiredPermissions)
      ) {
        accessGranted = true;
        accessReason = hasAllowedRole
          ? "Has allowed role"
          : "Has required permissions";
      }

      if (!accessGranted) {
        const userRolesInContext = await rbacService.getUserRolesInContext(
          user._id,
          targetContext._id,
          contextType
        );

        logger.warn(
          `Admin access denied for user ${user.email} (ID: ${
            user._id
          }) in ${contextType} ${targetContext._id}: Required ${
            requireSuperAdmin
              ? "organization SUPER_ADMIN role"
              : `roles: ${allowedRoles.join(
                  ", "
                )} or permissions: ${requiredPermissions.join(", ")}`
          }, but user has roles: [${userRolesInContext.join(", ") || "none"}]`
        );

        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: `This action requires ${
              requireSuperAdmin ? "super administrator" : "administrator"
            } privileges in this ${contextType}`,
            required: { roles: allowedRoles, permissions: requiredPermissions },
            userRoles: userRolesInContext,
          })
        );
      }

      // Store context information for use in controllers
      req.adminContext = {
        contextType,
        contextId: targetContext._id,
        context: targetContext,
        accessReason,
        userPermissions: await rbacService.getUserPermissionsInContext(
          user._id,
          targetContext._id,
          contextType
        ),
        isSuperAdmin: isSuperAdminInContext,
      };

      // For backward compatibility, also store in userGroupContext
      if (contextType === "group") {
        req.userGroupContext = {
          group: targetContext,
          role: { role_name: accessReason }, // Simplified role info
        };
      }

      logger.info(
        `Admin access granted for user ${user.email} in ${contextType} ${contextId}: ${accessReason}`
      );

      next();
    } catch (error) {
      logger.error(`Enhanced admin check error: ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Specific middleware for group admin access (replaces old adminCheck)
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
const requireGroupAdmin = (options = {}) => {
  return adminCheck({
    contextType: "group",
    idParam: "grp_id",
    fallbackIdParams: ["groupSlug", "grp_slug"],
    requireSuperAdmin: true,
    allowedRoles: ["SUPER_ADMIN", "GROUP_ADMIN"],
    requiredPermissions: ["GROUP_MANAGEMENT", "USER_MANAGEMENT"],
    ...options,
  });
};

/**
 * Flexible group access middleware for different permission levels
 * @param {Array} requiredPermissions - Required permissions
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
const requireGroupAccess = (
  requiredPermissions = ["GROUP_VIEW"],
  options = {}
) => {
  return adminCheck({
    contextType: "group",
    idParam: "grp_id",
    fallbackIdParams: ["groupSlug", "grp_slug"],
    requireSuperAdmin: false,
    allowedRoles: ["SUPER_ADMIN", "GROUP_ADMIN", "GROUP_MANAGER"],
    requiredPermissions,
    ...options,
  });
};

/**
 * Check if user can manage users in a specific group
 * @param {string} groupIdParam - Parameter name for group ID
 * @returns {Function} Express middleware
 */
const requireGroupUserManagement = (groupIdParam = "grp_id") => {
  return adminCheck({
    contextType: "group",
    idParam: groupIdParam,
    requireSuperAdmin: false,
    allowedRoles: ["SUPER_ADMIN", "GROUP_ADMIN"],
    requiredPermissions: ["USER_MANAGEMENT", "GROUP_USER_ASSIGN"],
  });
};

/**
 * Check if user can modify group settings
 * @param {string} groupIdParam - Parameter name for group ID
 * @returns {Function} Express middleware
 */
const requireGroupSettings = (groupIdParam = "grp_id") => {
  return adminCheck({
    contextType: "group",
    idParam: groupIdParam,
    requireSuperAdmin: false,
    allowedRoles: ["SUPER_ADMIN", "GROUP_ADMIN"],
    requiredPermissions: ["GROUP_SETTINGS", "GROUP_MANAGEMENT"],
  });
};

/**
 * Legacy adminCheck replacement that maintains backward compatibility
 * @returns {Function} Express middleware
 */
const legacyAdminCheck = async (req, res, next) => {
  try {
    // Handle organization-requests endpoints (AirQo-specific admin)
    if (
      req.path.includes("/organization-requests") ||
      req.originalUrl.includes("/organization-requests")
    ) {
      return adminCheck({
        contextType: "group",
        idParam: "grp_id",
        useGroupTitle: true,
        fallbackIdParams: ["grp_slug"],
        requireSuperAdmin: true,
      })(req, res, next);
    }

    // Get the group identifier from various sources
    const groupSlug =
      req.params.groupSlug ||
      req.params.grp_slug ||
      req.params.grp_id ||
      req.query.group ||
      req.body.group;

    if (!groupSlug) {
      return next(
        new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "Group identifier required",
        })
      );
    }

    // Determine if we should use grp_title or _id for lookup
    const useGroupTitle =
      req.query.useGroupTitle === "true" ||
      req.body.useGroupTitle === true ||
      !groupSlug.match(/^[0-9a-fA-F]{24}$/); // If it's not a valid ObjectId, assume it's a title

    return adminCheck({
      contextType: "group",
      idParam: "grp_id",
      useGroupTitle,
      requireSuperAdmin: true,
    })(req, res, next);
  } catch (error) {
    return next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

/**
 * Check if user is a system-wide super admin (across all tenants)
 * @returns {Function} Express middleware
 */
const requireSystemAdmin = () => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
          })
        );
      }

      const rbacService = getRBACService(tenant);

      // Check if user has system-wide admin permissions
      const requiredPermissions = [
        constants.SUPER_ADMIN,
        constants.SYSTEM_ADMIN,
      ];
      const hasPermission = await rbacService.hasPermission(
        user._id,
        requiredPermissions
      );

      if (!hasPermission) {
        const userPermissionsRaw = await rbacService.getUserPermissions(
          user._id
        );
        const userPermissions = Array.isArray(userPermissionsRaw)
          ? userPermissionsRaw
          : [];
        logger.warn(
          `System admin access denied for user ${user.email} (ID: ${
            user._id
          }): Required ANY of ${requiredPermissions.join(
            " OR "
          )}, but user has ${
            userPermissions.length ? userPermissions.join(", ") : "none"
          }`
        );

        return next(
          new HttpError(
            `Access denied. Required permissions: [${requiredPermissions.join(
              " or "
            )}]`,
            httpStatus.FORBIDDEN,
            {
              message: "You don't have system administrator access",
              required: requiredPermissions,
              userPermissions: userPermissions,
            }
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`System admin check error: ${error.message}`);
      next(
        new HttpError(
          "System admin check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Debug middleware to show admin access info (development only)
 */
const debugAdminAccess = () => {
  return async (req, res, next) => {
    try {
      if (constants.ENVIRONMENT === "production") {
        return next();
      }

      const user = req.user;
      if (user && user._id) {
        const tenant = req.query.tenant || constants.DEFAULT_TENANT;
        const rbacService = getRBACService(tenant);

        const debugInfo = await rbacService.debugUserPermissions(user._id);

        logger.info(`[DEBUG] Admin access info for ${user.email}:`, {
          isSuperAdmin: debugInfo.isSuperAdmin,
          groupRoles: debugInfo.groupRoles?.slice(0, 3), // First 3 group roles
          networkRoles: debugInfo.networkRoles?.slice(0, 3), // First 3 network roles
          allPermissions: debugInfo.allPermissions?.slice(0, 10), // First 10 permissions
        });

        if (req.query.debug === "true") {
          res.set(
            "X-Admin-Debug",
            JSON.stringify({
              isSuperAdmin: debugInfo.isSuperAdmin,
              totalGroupRoles: debugInfo.groupRoles?.length || 0,
              totalNetworkRoles: debugInfo.networkRoles?.length || 0,
              totalPermissions: debugInfo.allPermissions?.length || 0,
            })
          );
        }
      }

      next();
    } catch (error) {
      logger.error(`Debug admin access error: ${error.message}`);
      next();
    }
  };
};

module.exports = {
  adminCheck,
  requireGroupAdmin,
  requireGroupAccess,
  requireGroupUserManagement,
  requireGroupSettings,
  legacyAdminCheck,
  requireSystemAdmin,
  debugAdminAccess,
  adminCheck: legacyAdminCheck,
};
