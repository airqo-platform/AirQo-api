// middleware/groupNetworkAuth.js
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const log4js = require("log4js");
const constants = require("@config/constants");
const RBACService = require("@services/rbac.service");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- group-network-auth`
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

      const rbacService = getRBACService(tenant);

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

      const rbacService = getRBACService(tenant);

      // Use the dedicated, unambiguous check for system-wide super admin
      const isSystemSuperAdmin = await rbacService.isSystemSuperAdmin(user._id);
      if (isSystemSuperAdmin) {
        return next(); // System super admin bypasses further checks
      }

      // Also check for organization-specific admin roles
      const isGroupAdmin = await rbacService.hasRole(
        user._id,
        ["GROUP_ADMIN"],
        groupId,
        "group"
      );

      if (!isGroupAdmin) {
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
        isSystemSuperAdmin,
        isGroupAdmin,
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
    const rbacService = getRBACService(tenant);

    // Use the dedicated, unambiguous check for system-wide super admin
    const isSystemSuperAdmin = await rbacService.isSystemSuperAdmin(user._id);

    if (!isSystemSuperAdmin) {
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
      isSystemSuperAdmin,
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

      const rbacService = getRBACService(tenant);

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

    const rbacService = getRBACService(tenant);

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

    const rbacService = getRBACService(tenant);

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

      const rbacService = getRBACService(tenant);
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
        const rbacService = getRBACService(tenant);

        const debugInfo = await rbacService.debugUserPermissions(user._id);

        logger.info(`[DEBUG] Group/Network access for ${user.email}:`, {
          groupRoles: debugInfo.role_assignments?.groupRoles?.length || 0,
          networkRoles: debugInfo.role_assignments?.networkRoles?.length || 0,
          totalPermissions: debugInfo.permissions?.allPermissions?.length || 0,
          isSuperAdmin: debugInfo.admin_status?.isSystemSuperAdmin || false,
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

const requireOrganizationContext = (options = {}) => {
  const {
    paramName = "grp_id",
    bodyParam = "groupId",
    queryParam = "groupId",
    required = true,
    allowSuperAdmin = true,
  } = options;

  return async (req, res, next) => {
    try {
      const token = req.user;

      if (!token) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
            debugCode: "ORG_AUTH_MISSING",
            requestUrl: req.originalUrl,
          })
        );
      }

      const requestedOrgId =
        req.params[paramName] || req.body[bodyParam] || req.query[queryParam];

      if (required && !requestedOrgId) {
        return next(
          new HttpError(
            "Organization context required",
            httpStatus.BAD_REQUEST,
            {
              message: `Organization ID must be provided in URL parameter '${paramName}'`,
              debugCode: "ORG_ID_MISSING",
              details: {
                expectedInUrl: paramName,
                receivedParams: req.params,
                suggestions: [
                  `Ensure URL contains /:${paramName}/`,
                  "Check that the route parameter matches the expected name",
                ],
              },
            }
          )
        );
      }

      if (!requestedOrgId && !required) {
        return next();
      }

      const rbacService = getRBACService(token.tenant || "airqo");
      const isSystemSuperAdmin = await rbacService.isSystemSuperAdmin(
        token._id
      );

      const userContext = {
        hasCurrentContext: !!token.currentContext?.id,
        currentContextId: token.currentContext?.id,
        hasFullAccess: !!token.fullAccess?.groups,
        availableGroups: Object.keys(token.fullAccess?.groups || {}),
        isSuperAdmin: isSystemSuperAdmin,
      };

      // Super admin bypass
      if (allowSuperAdmin && userContext.isSuperAdmin) {
        logger.info(
          `[ORG_CONTEXT] Super admin ${token.email} accessing org ${requestedOrgId}`
        );
        req.organizationContext = requestedOrgId;
        return next();
      }

      // Access checks
      const hasCurrentContext = userContext.currentContextId === requestedOrgId;
      const hasFullAccess = !!token.fullAccess?.groups?.[requestedOrgId];
      const hasAnyAccess = hasCurrentContext || hasFullAccess;

      if (!hasAnyAccess) {
        // IMPROVED ERROR MESSAGES - more specific and clearer
        let specificMessage;
        let suggestions = [];
        let debugCode = "ORG_ACCESS_DENIED";

        if (!userContext.hasCurrentContext && !userContext.hasFullAccess) {
          // User has no organization access at all
          specificMessage = `Access denied: Your account is not assigned to organization '${requestedOrgId}' or any other organization`;
          suggestions = [
            "Contact your administrator to be added to this organization",
            "Verify that your account has been properly set up with organization access",
            "Try logging out and logging back in to refresh your permissions",
          ];
          debugCode = "NO_ORG_ACCESS";
        } else if (
          userContext.hasCurrentContext &&
          userContext.currentContextId !== requestedOrgId
        ) {
          // User has access to other orgs but not this one
          specificMessage = `Access denied: You're assigned to organization '${userContext.currentContextId}' but trying to access '${requestedOrgId}'`;
          suggestions = [
            "Switch to the correct organization context",
            "Ask your administrator for access to this organization",
            `Use your assigned organization: ${userContext.currentContextId}`,
          ];
          debugCode = "WRONG_ORG_CONTEXT";
        } else if (userContext.hasFullAccess && !hasFullAccess) {
          // User has access to some orgs but not this specific one
          specificMessage = `Access denied: You don't have access to organization '${requestedOrgId}'`;
          suggestions = [
            `You have access to: ${userContext.availableGroups.join(", ")}`,
            "Contact your administrator for access to this organization",
            "Verify the organization ID is correct",
          ];
          debugCode = "ORG_NOT_ACCESSIBLE";
        } else {
          // Fallback
          specificMessage = `Access denied: Cannot access organization '${requestedOrgId}'`;
          suggestions = ["Contact your administrator for assistance"];
        }

        logger.warn(`[ORG_CONTEXT] ${debugCode} for user ${token.email}:`, {
          requestedOrg: requestedOrgId,
          userCurrentContext: userContext.currentContextId,
          userAvailableOrgs: userContext.availableGroups,
        });

        return next(
          new HttpError("Invalid organization context", httpStatus.FORBIDDEN, {
            message: specificMessage,
            debugCode: debugCode,
            details: {
              requestedOrganization: requestedOrgId,
              userCurrentContext: userContext.currentContextId,
              availableOrganizations: userContext.availableGroups,
              suggestions: suggestions,
              userId: token._id,
              userEmail: token.email,
            },
          })
        );
      }

      // Success
      logger.info(
        `[ORG_CONTEXT] Access granted: ${token.email} -> org ${requestedOrgId}`
      );
      req.organizationContext = requestedOrgId;
      next();
    } catch (error) {
      logger.error(`[ORG_CONTEXT] Error: ${error.message}`);
      next(
        new HttpError(
          "Organization context validation failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            debugCode: "ORG_CONTEXT_ERROR",
            details: {
              originalError: error.message,
              userId: req.user?._id,
              url: req.originalUrl,
            },
          }
        )
      );
    }
  };
};

const requireOrganizationContextEnhanced = (options = {}) => {
  const {
    paramName = "grp_id",
    bodyParam = "groupId",
    queryParam = "groupId",
    required = true,
    allowSuperAdmin = true,
  } = options;

  return async (req, res, next) => {
    try {
      const token = req.user;

      // Enhanced debugging info
      const debugInfo = {
        userId: token?._id,
        userEmail: token?.email,
        requestedUrl: req.originalUrl,
        requestMethod: req.method,
        params: req.params,
        hasUser: !!token,
        timestamp: new Date().toISOString(),
      };

      if (!token) {
        logger.warn("[ORG_CONTEXT] Authentication missing:", debugInfo);
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
            debugCode: "ORG_AUTH_MISSING",
            requestUrl: req.originalUrl,
          })
        );
      }

      // Get organization ID from various sources with detailed logging
      const requestedOrgId =
        req.params[paramName] || req.body[bodyParam] || req.query[queryParam];

      debugInfo.requestedOrgId = requestedOrgId;
      debugInfo.searchedInParams = paramName;
      debugInfo.searchedInBody = bodyParam;
      debugInfo.searchedInQuery = queryParam;

      if (required && !requestedOrgId) {
        logger.warn("[ORG_CONTEXT] Organization ID missing:", debugInfo);
        return next(
          new HttpError(
            "Organization context required",
            httpStatus.BAD_REQUEST,
            {
              message: `Organization ID must be provided in URL parameter '${paramName}', body parameter '${bodyParam}', or query parameter '${queryParam}'`,
              debugCode: "ORG_ID_MISSING",
              expectedSources: {
                urlParam: paramName,
                bodyParam: bodyParam,
                queryParam: queryParam,
              },
              receivedParams: req.params,
              receivedBody: Object.keys(req.body || {}),
              receivedQuery: Object.keys(req.query || {}),
            }
          )
        );
      }

      // Skip validation if no org ID and not required
      if (!requestedOrgId && !required) {
        return next();
      }

      const rbacService = getRBACService(token.tenant || "airqo");
      const isSystemSuperAdmin = await rbacService.isSystemSuperAdmin(
        token._id
      );

      // Enhanced user context analysis
      const userContext = {
        hasCurrentContext: !!token.currentContext?.id,
        currentContextId: token.currentContext?.id,
        hasFullAccess: !!token.fullAccess?.groups,
        availableGroups: Object.keys(token.fullAccess?.groups || {}),
        hasRoles: !!token.roles?.length,
        userRoles: token.roles || [],
        isSuperAdmin: isSystemSuperAdmin,
      };

      debugInfo.userContext = userContext;

      // Super admin bypass with logging
      if (allowSuperAdmin && userContext.isSuperAdmin) {
        logger.info("[ORG_CONTEXT] Super admin access granted:", {
          ...debugInfo,
          accessType: "super_admin_bypass",
        });
        req.organizationContext = requestedOrgId;
        req.organizationAccess = {
          hasAccess: true,
          accessType: "super_admin",
          organizationId: requestedOrgId,
        };
        return next();
      }

      // Detailed access checks
      const accessChecks = {
        hasCurrentContext: userContext.currentContextId === requestedOrgId,
        hasFullAccess: !!token.fullAccess?.groups?.[requestedOrgId],
        hasGeneralRoleAccess: userContext.userRoles.some((role) =>
          ["SUPER_ADMIN", "GROUP_ADMIN", "SYSTEM_ADMIN"].includes(role)
        ),
      };

      const hasAnyAccess = Object.values(accessChecks).some(Boolean);

      debugInfo.accessChecks = accessChecks;
      debugInfo.hasAnyAccess = hasAnyAccess;

      if (!hasAnyAccess) {
        // Detailed error message based on what's missing
        let specificErrorMessage = "You don't have access to this organization";
        let suggestions = [];

        if (!userContext.hasCurrentContext && !userContext.hasFullAccess) {
          specificErrorMessage =
            "Your account doesn't have access to any organizations";
          suggestions.push(
            "Contact your administrator to be added to an organization"
          );
        } else if (
          userContext.hasCurrentContext &&
          userContext.currentContextId !== requestedOrgId
        ) {
          specificErrorMessage = `You're currently in organization '${userContext.currentContextId}' but trying to access '${requestedOrgId}'`;
          suggestions.push("Switch to the correct organization context");
          suggestions.push(
            "Ensure you have access to the requested organization"
          );
        } else if (
          userContext.hasFullAccess &&
          !token.fullAccess.groups[requestedOrgId]
        ) {
          specificErrorMessage = `You don't have access to organization '${requestedOrgId}'`;
          suggestions.push(
            `Available organizations: ${
              userContext.availableGroups.join(", ") || "none"
            }`
          );
        }

        logger.warn("[ORG_CONTEXT] Access denied:", {
          ...debugInfo,
          specificErrorMessage,
          suggestions,
        });

        return next(
          new HttpError("Invalid organization context", httpStatus.FORBIDDEN, {
            message: specificErrorMessage,
            debugCode: "ORG_ACCESS_DENIED",
            organizationId: requestedOrgId,
            userCurrentContext: userContext.currentContextId,
            availableOrganizations: userContext.availableGroups,
            suggestions: suggestions,
            accessChecks: accessChecks,
            // Include detailed info for development
            ...(process.env.NODE_ENV !== "production" && {
              debugInfo: debugInfo,
            }),
          })
        );
      }

      // Success - determine access type and log
      let accessType = "unknown";
      if (accessChecks.hasCurrentContext) accessType = "current_context";
      else if (accessChecks.hasFullAccess) accessType = "full_access";
      else if (accessChecks.hasGeneralRoleAccess) accessType = "role_based";

      logger.info("[ORG_CONTEXT] Access granted:", {
        userId: token._id,
        email: token.email,
        organizationId: requestedOrgId,
        accessType: accessType,
        url: req.originalUrl,
      });

      // Set enhanced context for downstream middleware/controllers
      req.organizationContext = requestedOrgId;
      req.organizationAccess = {
        hasAccess: true,
        accessType: accessType,
        organizationId: requestedOrgId,
        permissions:
          token.fullAccess?.groups?.[requestedOrgId]?.permissions || [],
        userContext: userContext,
      };

      next();
    } catch (error) {
      logger.error(`[ORG_CONTEXT] Middleware error: ${error.message}`, {
        userId: req.user?._id,
        url: req.originalUrl,
        stack: error.stack,
      });
      next(
        new HttpError(
          "Organization context validation failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
            debugCode: "ORG_CONTEXT_ERROR",
            originalError:
              process.env.NODE_ENV !== "production" ? error.stack : undefined,
          }
        )
      );
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
  requireOrganizationContext,
  requireOrganizationContextEnhanced,
};
