// middleware/permissionAuth.js
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const log4js = require("log4js");
const constants = require("@config/constants");
const RBACService = require("@services/rbac.service");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- permission-auth`);

/**
 * Check if user has required permissions (global across all groups/networks)
 * @param {string|Array} requiredPermissions - Permission(s) to check
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
const requirePermissions = (requiredPermissions, options = {}) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const { requireAll = false } = options;

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
          })
        );
      }

      const rbacService = new RBACService(tenant);

      const requiredPerms = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      const hasPermission = await rbacService.hasPermission(
        user._id,
        requiredPerms,
        requireAll
      );

      if (!hasPermission) {
        const userPermissions = await rbacService.getUserPermissions(user._id);

        const normalizedRequiredPerms = requiredPerms.map((perm) => {
          if (perm.includes(":")) {
            return perm.replace(":", "_").toUpperCase();
          }
          return perm.toUpperCase();
        });

        logger.warn(
          `Permission denied for user ${user.email} (ID: ${
            user._id
          }): Required ${
            requireAll ? "ALL of" : "ANY of"
          } ${normalizedRequiredPerms.join(
            requireAll ? " AND " : " OR "
          )}, but user has ${userPermissions.join(", ") || "none"}`
        );

        return next(
          new HttpError(
            "Access denied: Insufficient permissions",
            httpStatus.FORBIDDEN,
            {
              message:
                "You don't have the required permissions to access this resource",
              required: normalizedRequiredPerms,
              userPermissions: userPermissions,
              requiresAll: requireAll,
            }
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`Permission check error: ${error.message}`);
      next(
        new HttpError(
          "Permission check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Check if user has ALL specified permissions
 * @param {string|Array} requiredPermissions - Permission(s) to check
 * @returns {Function} Express middleware
 */
const requireAllPermissions = (requiredPermissions) => {
  return requirePermissions(requiredPermissions, { requireAll: true });
};

/**
 * Check if user has required permissions within a specific group context
 * @param {string|Array} requiredPermissions - Permission(s) to check
 * @param {string} groupIdParam - Parameter name containing group ID (default: 'grp_id' or 'groupSlug')
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
const requireGroupPermissions = (
  requiredPermissions,
  groupIdParam = "grp_id",
  options = {}
) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const { requireAll = false } = options;

      const groupId =
        req.params[groupIdParam] ||
        req.params.groupSlug ||
        req.body[groupIdParam];

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

      // Check if user is a member of the group first
      const isGroupMember = await rbacService.isGroupMember(user._id, groupId);
      if (!isGroupMember) {
        return next(
          new HttpError(
            "Access denied: Not a group member",
            httpStatus.FORBIDDEN,
            {
              message: "You are not a member of this group",
            }
          )
        );
      }

      const requiredPerms = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      const hasPermission = await rbacService.hasPermission(
        user._id,
        requiredPerms,
        requireAll,
        groupId,
        "group"
      );

      if (!hasPermission) {
        const userPermissions = await rbacService.getUserPermissionsInContext(
          user._id,
          groupId,
          "group"
        );

        logger.warn(
          `Group permission denied for user ${user.email} (ID: ${
            user._id
          }) in group ${groupId}: Required ${requiredPerms.join(
            requireAll ? " AND " : " OR "
          )}, but user has ${userPermissions.join(", ") || "none"}`
        );

        return next(
          new HttpError(
            "Access denied: Insufficient group permissions",
            httpStatus.FORBIDDEN,
            {
              message: "You don't have the required permissions in this group",
              required: requiredPerms,
              userPermissions: userPermissions,
              groupId: groupId,
              requiresAll: requireAll,
            }
          )
        );
      }

      // Store group context for use in controllers
      req.groupContext = {
        groupId,
        userPermissions: await rbacService.getUserPermissionsInContext(
          user._id,
          groupId,
          "group"
        ),
      };

      next();
    } catch (error) {
      logger.error(`Group permission check error: ${error.message}`);
      next(
        new HttpError(
          "Permission check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Check if user has required permissions within a specific network context
 * @param {string|Array} requiredPermissions - Permission(s) to check
 * @param {string} networkIdParam - Parameter name containing network ID (default: 'network_id')
 * @param {Object} options - Additional options
 * @returns {Function} Express middleware
 */
const requireNetworkPermissions = (
  requiredPermissions,
  networkIdParam = "network_id",
  options = {}
) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const { requireAll = false } = options;

      const networkId = req.params[networkIdParam] || req.body[networkIdParam];

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
          })
        );
      }

      if (!networkId) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Network identifier required",
          })
        );
      }

      const rbacService = new RBACService(tenant);

      // Check if user is a member of the network first
      const isNetworkMember = await rbacService.isNetworkMember(
        user._id,
        networkId
      );
      if (!isNetworkMember) {
        return next(
          new HttpError(
            "Access denied: Not a network member",
            httpStatus.FORBIDDEN,
            {
              message: "You are not a member of this network",
            }
          )
        );
      }

      const requiredPerms = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      const hasPermission = await rbacService.hasPermission(
        user._id,
        requiredPerms,
        requireAll,
        networkId,
        "network"
      );

      if (!hasPermission) {
        const userPermissions = await rbacService.getUserPermissionsInContext(
          user._id,
          networkId,
          "network"
        );

        logger.warn(
          `Network permission denied for user ${user.email} (ID: ${
            user._id
          }) in network ${networkId}: Required ${requiredPerms.join(
            requireAll ? " AND " : " OR "
          )}, but user has ${userPermissions.join(", ") || "none"}`
        );

        return next(
          new HttpError(
            "Access denied: Insufficient network permissions",
            httpStatus.FORBIDDEN,
            {
              message:
                "You don't have the required permissions in this network",
              required: requiredPerms,
              userPermissions: userPermissions,
              networkId: networkId,
              requiresAll: requireAll,
            }
          )
        );
      }

      // Store network context for use in controllers
      req.networkContext = {
        networkId,
        userPermissions: await rbacService.getUserPermissionsInContext(
          user._id,
          networkId,
          "network"
        ),
      };

      next();
    } catch (error) {
      logger.error(`Network permission check error: ${error.message}`);
      next(
        new HttpError(
          "Permission check failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

/**
 * Check if user has required roles
 * @param {string|Array} requiredRoles - Role(s) to check
 * @param {string} contextId - Optional context (group/network ID)
 * @param {string} contextType - 'group' or 'network'
 * @returns {Function} Express middleware
 */
const requireRoles = (
  requiredRoles,
  contextId = null,
  contextType = "group"
) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED)
        );
      }

      const rbacService = new RBACService(tenant);

      // If contextId is a parameter name, get it from req.params
      let actualContextId = contextId;
      if (typeof contextId === "string" && req.params[contextId]) {
        actualContextId = req.params[contextId];
      }

      const hasRole = await rbacService.hasRole(
        user._id,
        requiredRoles,
        actualContextId,
        contextType
      );

      if (!hasRole) {
        const roles = Array.isArray(requiredRoles)
          ? requiredRoles
          : [requiredRoles];

        logger.warn(
          `Role access denied for user ${user.email} (ID: ${
            user._id
          }): Required ${roles.join(" OR ")} in ${contextType}${
            actualContextId ? ` ${actualContextId}` : ""
          }`
        );

        return next(
          new HttpError(
            "Access denied: You don't have the required role",
            httpStatus.FORBIDDEN,
            {
              required: roles,
              contextType,
              contextId: actualContextId,
              message:
                "You don't have the required role to access this resource",
            }
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`Role check error: ${error.message}`);
      next(
        new HttpError("Authorization error", httpStatus.INTERNAL_SERVER_ERROR)
      );
    }
  };
};

/**
 * Check if user is a group member
 * @param {string} groupIdParam - Parameter name containing group ID (default: 'grp_id')
 * @returns {Function} Express middleware
 */
const requireGroupMembership = (groupIdParam = "grp_id") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const groupId = req.params[groupIdParam] || req.body[groupIdParam];

      if (!user || !user._id || !groupId) {
        return next(
          new HttpError(
            "Access denied: Group membership required",
            httpStatus.FORBIDDEN
          )
        );
      }

      const rbacService = new RBACService(tenant);

      const isGroupMember = await rbacService.isGroupMember(user._id, groupId);
      const isSuperAdmin = await rbacService.hasRole(user._id, [
        "SUPER_ADMIN",
        "super_admin",
      ]);

      if (!isGroupMember && !isSuperAdmin) {
        return next(
          new HttpError(
            "Access denied: You are not a member of this group",
            httpStatus.FORBIDDEN
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`Group membership check error: ${error.message}`);
      next(
        new HttpError("Authorization error", httpStatus.INTERNAL_SERVER_ERROR)
      );
    }
  };
};

/**
 * Check if user is a group manager
 * @param {string} groupIdParam - Parameter name containing group ID (default: 'grp_id')
 * @returns {Function} Express middleware
 */
const requireGroupManager = (groupIdParam = "grp_id") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const groupId = req.params[groupIdParam] || req.body[groupIdParam];

      if (!user || !user._id || !groupId) {
        return next(
          new HttpError(
            "Access denied: Group manager access required",
            httpStatus.FORBIDDEN
          )
        );
      }

      const rbacService = new RBACService(tenant);

      const isGroupManager = await rbacService.isGroupManager(
        user._id,
        groupId
      );
      const isSuperAdmin = await rbacService.hasRole(user._id, [
        "SUPER_ADMIN",
        "super_admin",
      ]);

      if (!isGroupManager && !isSuperAdmin) {
        return next(
          new HttpError(
            "Access denied: Only group managers can perform this action",
            httpStatus.FORBIDDEN
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`Group manager check error: ${error.message}`);
      next(
        new HttpError("Authorization error", httpStatus.INTERNAL_SERVER_ERROR)
      );
    }
  };
};

/**
 * Check if user is a network member
 * @param {string} networkIdParam - Parameter name containing network ID (default: 'network_id')
 * @returns {Function} Express middleware
 */
const requireNetworkMembership = (networkIdParam = "network_id") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const networkId = req.params[networkIdParam] || req.body[networkIdParam];

      if (!user || !user._id || !networkId) {
        return next(
          new HttpError(
            "Access denied: Network membership required",
            httpStatus.FORBIDDEN
          )
        );
      }

      const rbacService = new RBACService(tenant);

      const isNetworkMember = await rbacService.isNetworkMember(
        user._id,
        networkId
      );
      const isSuperAdmin = await rbacService.hasRole(user._id, [
        "SUPER_ADMIN",
        "super_admin",
      ]);

      if (!isNetworkMember && !isSuperAdmin) {
        return next(
          new HttpError(
            "Access denied: You are not a member of this network",
            httpStatus.FORBIDDEN
          )
        );
      }

      next();
    } catch (error) {
      logger.error(`Network membership check error: ${error.message}`);
      next(
        new HttpError("Authorization error", httpStatus.INTERNAL_SERVER_ERROR)
      );
    }
  };
};

/**
 * Check resource ownership
 * @param {Function} resourceFetcher - Function to fetch the resource
 * @param {Function} ownerExtractor - Function to extract owner ID from resource
 * @returns {Function} Express middleware
 */
const requireResourceOwnership = (resourceFetcher, ownerExtractor) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;

      if (!user || !user._id) {
        return next(
          new HttpError(
            "Access denied: Authentication required",
            httpStatus.FORBIDDEN
          )
        );
      }

      const resource = await resourceFetcher(req);

      if (!resource) {
        return next(new HttpError("Resource not found", httpStatus.NOT_FOUND));
      }

      const ownerId = ownerExtractor(resource);

      const rbacService = new RBACService(tenant);
      const isSuperAdmin = await rbacService.hasRole(user._id, [
        "SUPER_ADMIN",
        "super_admin",
      ]);

      const isOwner = ownerId && ownerId.toString() === user._id.toString();

      if (!isOwner && !isSuperAdmin) {
        return next(
          new HttpError(
            "Access denied: You don't own this resource",
            httpStatus.FORBIDDEN
          )
        );
      }

      req.resource = resource;
      next();
    } catch (error) {
      logger.error(`Resource ownership check error: ${error.message}`);
      next(
        new HttpError("Authorization error", httpStatus.INTERNAL_SERVER_ERROR)
      );
    }
  };
};

/**
 * Debug permissions middleware (development only)
 */
const debugPermissions = () => {
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
        logger.info(`[DEBUG] User permissions for ${user.email}:`, debugInfo);

        if (req.query.debug === "true") {
          res.set(
            "X-User-Permissions",
            JSON.stringify(debugInfo.allPermissions)
          );
          res.set("X-User-Group-Roles", JSON.stringify(debugInfo.groupRoles));
          res.set(
            "X-User-Network-Roles",
            JSON.stringify(debugInfo.networkRoles)
          );
        }
      }

      next();
    } catch (error) {
      logger.error(`Debug permissions error: ${error.message}`);
      next();
    }
  };
};

/**
 * Get RBAC service instance
 * @param {string} tenant - Tenant identifier
 * @returns {RBACService} RBAC service instance
 */
const getRBACService = (tenant = constants.DEFAULT_TENANT) => {
  return new RBACService(tenant);
};

module.exports = {
  requirePermissions,
  requireAllPermissions,
  requireGroupPermissions,
  requireNetworkPermissions,
  requireRoles,
  requireGroupMembership,
  requireGroupManager,
  requireNetworkMembership,
  requireResourceOwnership,
  debugPermissions,
  getRBACService,
};
