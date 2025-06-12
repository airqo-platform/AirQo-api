// middleware/groupNetworkAuth.js
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const log4js = require("log4js");
const constants = require("@config/constants");
const RBACService = require("@services/rbac.service");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- group-network-auth`
);

/**
 * Middleware to check if user has group manager access
 * @param {string} groupIdParam - Parameter name containing group ID
 * @returns {Function} Express middleware
 */
const requireGroupManagerAccess = (groupIdParam = "grp_id") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const groupId = req.params[groupIdParam] || req.body[groupIdParam];

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
          })
        );
      }

      if (!groupId) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Group identifier required",
          })
        );
      }

      const rbacService = new RBACService(tenant);

      // Check if user is group manager
      const isGroupManager = await rbacService.isGroupManager(
        user._id,
        groupId
      );

      // Check if user has manager-level permissions
      const hasManagerPermissions = await rbacService.hasPermission(
        user._id,
        ["GROUP_MANAGEMENT", "USER_MANAGEMENT", "GROUP_SETTINGS"],
        false, // any of these permissions
        groupId,
        "group"
      );

      // Check if user has manager-level roles
      const hasManagerRole = await rbacService.hasRole(
        user._id,
        ["SUPER_ADMIN", "GROUP_ADMIN", "GROUP_MANAGER"],
        groupId,
        "group"
      );

      if (!isGroupManager && !hasManagerPermissions && !hasManagerRole) {
        logger.warn(
          `Group manager access denied for user ${user.email} (ID: ${user._id}) in group ${groupId}: Not group manager and no manager permissions/roles`
        );

        return next(
          new HttpError(
            "Access denied: Group manager access required",
            httpStatus.FORBIDDEN,
            {
              message:
                "You don't have group management access to this resource",
              groupId,
            }
          )
        );
      }

      // Store group manager context
      req.groupManagerContext = {
        groupId,
        isActualManager: isGroupManager,
        hasManagerPermissions,
        hasManagerRole,
        userPermissions: await rbacService.getUserPermissionsInContext(
          user._id,
          groupId,
          "group"
        ),
      };

      next();
    } catch (error) {
      logger.error(`Group manager access check error: ${error.message}`);
      next(
        new HttpError(
          "Group manager access check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Middleware to check if user has group admin access (higher than manager)
 * @param {string} groupIdParam - Parameter name containing group ID
 * @returns {Function} Express middleware
 */
const requireGroupAdminAccess = (groupIdParam = "grp_id") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const groupId = req.params[groupIdParam] || req.body[groupIdParam];

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
          })
        );
      }

      if (!groupId) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Group identifier required",
          })
        );
      }

      const rbacService = new RBACService(tenant);

      // Check if user has admin-level permissions
      const hasAdminPermissions = await rbacService.hasPermission(
        user._id,
        ["GROUP_ADMIN", "USER_ADMIN", "SYSTEM_ADMIN"],
        false, // any of these permissions
        groupId,
        "group"
      );

      // Check if user has admin-level roles
      const hasAdminRole = await rbacService.hasRole(
        user._id,
        ["SUPER_ADMIN", "GROUP_ADMIN"],
        groupId,
        "group"
      );

      if (!hasAdminPermissions && !hasAdminRole) {
        logger.warn(
          `Group admin access denied for user ${user.email} (ID: ${user._id}) in group ${groupId}: No admin permissions/roles`
        );

        return next(
          new HttpError(
            "Access denied: Group admin access required",
            httpStatus.FORBIDDEN,
            {
              message: "You don't have administrative access to this group",
              groupId,
            }
          )
        );
      }

      // Store group admin context
      req.groupAdminContext = {
        groupId,
        hasAdminPermissions,
        hasAdminRole,
        userPermissions: await rbacService.getUserPermissionsInContext(
          user._id,
          groupId,
          "group"
        ),
      };

      next();
    } catch (error) {
      logger.error(`Group admin access check error: ${error.message}`);
      next(
        new HttpError(
          "Group admin access check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Middleware to check if user has super admin access across all groups
 * @returns {Function} Express middleware
 */
const requireSuperAdminAccess = async (req, res, next) => {
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

    const rbacService = new RBACService(tenant);

    // Check if user has super admin role across all contexts
    const hasSuperAdminRole = await rbacService.hasRole(user._id, [
      "SUPER_ADMIN",
    ]);

    // Check if user has super admin permissions
    const hasSuperAdminPermissions = await rbacService.hasPermission(
      user._id,
      ["SUPER_ADMIN", "SYSTEM_ADMIN", "FULL_ACCESS"],
      true // require ALL permissions
    );

    if (!hasSuperAdminRole && !hasSuperAdminPermissions) {
      logger.warn(
        `Super admin access denied for user ${user.email} (ID: ${user._id}): No super admin role or permissions`
      );

      return next(
        new HttpError(
          "Access denied: Super admin access required",
          httpStatus.FORBIDDEN,
          {
            message:
              "You don't have super administrator access to this resource",
          }
        )
      );
    }

    // Store super admin context
    req.superAdminContext = {
      hasSuperAdminRole,
      hasSuperAdminPermissions,
      allPermissions: await rbacService.getUserPermissions(user._id),
    };

    next();
  } catch (error) {
    logger.error(`Super admin access check error: ${error.message}`);
    next(
      new HttpError(
        "Super admin access check failed",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      )
    );
  }
};

/**
 * Middleware to check if user can manage other group members
 * @param {string} groupIdParam - Parameter name containing group ID
 * @returns {Function} Express middleware
 */
const requireGroupMemberManagementAccess = (groupIdParam = "grp_id") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const groupId = req.params[groupIdParam] || req.body[groupIdParam];

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED)
        );
      }

      if (!groupId) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Group identifier required",
          })
        );
      }

      const rbacService = new RBACService(tenant);

      // Check if user has member management permissions
      const hasMemberManagePermission = await rbacService.hasPermission(
        user._id,
        ["MEMBER_MANAGE", "USER_MANAGEMENT", "GROUP_USER_ASSIGN"],
        false, // any of these permissions
        groupId,
        "group"
      );

      // Check if user has appropriate management roles
      const hasManagementRole = await rbacService.hasRole(
        user._id,
        ["SUPER_ADMIN", "GROUP_ADMIN", "GROUP_MANAGER"],
        groupId,
        "group"
      );

      if (!hasMemberManagePermission && !hasManagementRole) {
        logger.warn(
          `Group member management access denied for user ${user.email} (ID: ${user._id}) in group ${groupId}`
        );

        return next(
          new HttpError(
            "Access denied: Group member management access required",
            httpStatus.FORBIDDEN,
            {
              message: "You don't have permission to manage group members",
              groupId,
            }
          )
        );
      }

      next();
    } catch (error) {
      logger.error(
        `Group member management access check error: ${error.message}`
      );
      next(
        new HttpError(
          "Group member management access check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Utility function to check if user is a verified group member
 * @param {Object} user - User object
 * @param {string} groupId - Group ID
 * @param {string} tenant - Tenant identifier
 * @returns {Promise<boolean>} Whether user is verified group member
 */
const isVerifiedGroupMember = async (user, groupId, tenant) => {
  try {
    if (!user || !user._id || !groupId) {
      return false;
    }

    // Must be verified and active
    if (!user.verified || user.status !== "active") {
      return false;
    }

    const rbacService = new RBACService(tenant);

    // Check group membership
    const isGroupMember = await rbacService.isGroupMember(user._id, groupId);

    return isGroupMember;
  } catch (error) {
    logger.error(
      `Error checking verified group member status: ${error.message}`
    );
    return false;
  }
};

/**
 * Utility function to check if user is a verified network member
 * @param {Object} user - User object
 * @param {string} networkId - Network ID
 * @param {string} tenant - Tenant identifier
 * @returns {Promise<boolean>} Whether user is verified network member
 */
const isVerifiedNetworkMember = async (user, networkId, tenant) => {
  try {
    if (!user || !user._id || !networkId) {
      return false;
    }

    // Must be verified and active
    if (!user.verified || user.status !== "active") {
      return false;
    }

    const rbacService = new RBACService(tenant);

    // Check network membership
    const isNetworkMember = await rbacService.isNetworkMember(
      user._id,
      networkId
    );

    return isNetworkMember;
  } catch (error) {
    logger.error(
      `Error checking verified network member status: ${error.message}`
    );
    return false;
  }
};

/**
 * Middleware to check multiple group access (user must have access to all specified groups)
 * @param {Array} groupIds - Array of group IDs to check
 * @param {Array} requiredPermissions - Required permissions in each group
 * @returns {Function} Express middleware
 */
const requireMultipleGroupAccess = (
  groupIds,
  requiredPermissions = ["GROUP_VIEW"]
) => {
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

      const rbacService = new RBACService(tenant);
      const accessResults = [];

      for (const groupId of groupIds) {
        const isGroupMember = await rbacService.isGroupMember(
          user._id,
          groupId
        );
        const hasPermissions = await rbacService.hasPermission(
          user._id,
          requiredPermissions,
          false, // any of the permissions
          groupId,
          "group"
        );

        accessResults.push({
          groupId,
          hasAccess: isGroupMember && hasPermissions,
          isGroupMember,
          hasPermissions,
        });
      }

      const failedAccess = accessResults.filter((result) => !result.hasAccess);

      if (failedAccess.length > 0) {
        return next(
          new HttpError(
            "Access denied: Insufficient group access",
            httpStatus.FORBIDDEN,
            {
              message: "You don't have access to all required groups",
              failedGroups: failedAccess.map((f) => f.groupId),
              requiredPermissions,
            }
          )
        );
      }

      req.multiGroupContext = {
        accessResults,
        allGroupsAccessible: true,
      };

      next();
    } catch (error) {
      logger.error(`Multiple group access check error: ${error.message}`);
      next(
        new HttpError(
          "Multiple group access check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Debug middleware to show group/network access info (development only)
 */
const debugGroupNetworkAccess = () => {
  return async (req, res, next) => {
    try {
      if (constants.ENVIRONMENT === "production") {
        return next();
      }

      const user = req.user;
      if (user && user._id) {
        const tenant = req.query.tenant || constants.DEFAULT_TENANT;
        const rbacService = new RBACService(tenant);

        const debugInfo = await rbacService.debugUserPermissions(user._id);

        logger.info(`[DEBUG] Group/Network access for ${user.email}:`, {
          groupRoles: debugInfo.groupRoles?.length || 0,
          networkRoles: debugInfo.networkRoles?.length || 0,
          totalPermissions: debugInfo.allPermissions?.length || 0,
          isSuperAdmin: debugInfo.isSuperAdmin,
        });

        if (req.query.debug === "true") {
          res.set(
            "X-Group-Roles",
            debugInfo.groupRoles?.length.toString() || "0"
          );
          res.set(
            "X-Network-Roles",
            debugInfo.networkRoles?.length.toString() || "0"
          );
          res.set(
            "X-Is-Super-Admin",
            debugInfo.isSuperAdmin?.toString() || "false"
          );
        }
      }

      next();
    } catch (error) {
      logger.error(`Debug group/network access error: ${error.message}`);
      next();
    }
  };
};

module.exports = {
  requireGroupManagerAccess,
  requireGroupAdminAccess,
  requireSuperAdminAccess,
  requireGroupMemberManagementAccess,
  requireMultipleGroupAccess,
  isVerifiedGroupMember,
  isVerifiedNetworkMember,
  debugGroupNetworkAccess,
};
