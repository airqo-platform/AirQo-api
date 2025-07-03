// services/rbac.service.js - Complete Enhanced RBAC Service
const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const UserModel = require("@models/User");
const GroupModel = require("@models/Group");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- rbac-service`
);
const { logObject } = require("@utils/shared");
const ObjectId = require("mongoose").Types.ObjectId;

class RBACService {
  constructor(tenant = "airqo") {
    this.tenant = tenant;
    this.permissionCache = new Map();
    this.roleCache = new Map();
    this.userCache = new Map();
    this.systemPermissionsCache = null;
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    this.SYSTEM_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for system permissions

    // Set up periodic cache cleanup (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 5 * 60 * 1000);

    logger.debug(`RBAC Service initialized for tenant: ${tenant}`);
  }

  /**
   * Cleanup resources when service is destroyed
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearCache();
    logger.debug(`RBAC Service destroyed for tenant: ${this.tenant}`);
  }

  /**
   * Check if user is a system-wide super admin (AirQo super admin)
   * These users can access ANY group/network regardless of membership
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async isSystemSuperAdmin(userId) {
    try {
      const cacheKey = `system_super_${userId}`;
      const now = Date.now();

      // Check cache first
      if (this.userCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && expiry > now) {
          logger.debug(`Cache hit for system super admin check: ${userId}`);
          return this.userCache.get(cacheKey);
        } else {
          this.userCache.delete(cacheKey);
          this.cacheExpiry.delete(cacheKey);
        }
      }

      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate("group_roles.role", "role_name role_code role_permissions")
        .populate("network_roles.role", "role_name role_code role_permissions")
        .lean();

      if (!user) {
        logger.warn(`User ${userId} not found for system super admin check`);
        return false;
      }

      // Check for AirQo super admin role specifically
      const hasAirQoSuperAdmin = this.hasAirQoSuperAdminRole(user);
      if (hasAirQoSuperAdmin) {
        logger.info(`User ${userId} has AirQo super admin role`);
        this.userCache.set(cacheKey, true);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
        return true;
      }

      // Check for any super admin role with system-wide permissions
      const hasSystemPermissions = await this.hasSystemWidePermissions(userId);
      if (hasSystemPermissions) {
        logger.info(`User ${userId} has system-wide permissions`);
        this.userCache.set(cacheKey, true);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
        return true;
      }

      // Cache negative result too
      this.userCache.set(cacheKey, false);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
      return false;
    } catch (error) {
      logger.error(`Error checking system super admin: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user has AirQo super admin role specifically
   * @param {Object} user - User object with populated roles
   * @returns {boolean}
   */
  hasAirQoSuperAdminRole(user) {
    if (!user) return false;

    // Check group roles for AirQo super admin
    if (user.group_roles && user.group_roles.length > 0) {
      const hasAirQoSuper = user.group_roles.some((groupRole) => {
        if (!groupRole.role) return false;

        const roleName =
          typeof groupRole.role === "object"
            ? groupRole.role.role_name
            : groupRole.role;
        const roleCode =
          typeof groupRole.role === "object" ? groupRole.role.role_code : null;

        if (!roleName) return false;

        // Check for exact AirQo super admin patterns
        const isAirQoSuper =
          roleName === "AIRQO_SUPER_ADMIN" ||
          roleCode === "AIRQO_SUPER_ADMIN" ||
          (roleName.includes("AIRQO") && roleName.includes("SUPER_ADMIN")) ||
          (roleCode &&
            roleCode.includes("AIRQO") &&
            roleCode.includes("SUPER_ADMIN"));

        if (isAirQoSuper) {
          logger.debug(
            `Found AirQo super admin role: ${roleName} (${roleCode})`
          );
          return true;
        }
        return false;
      });
      if (hasAirQoSuper) return true;
    }

    // Check network roles for AirQo super admin
    if (user.network_roles && user.network_roles.length > 0) {
      const hasAirQoSuper = user.network_roles.some((networkRole) => {
        if (!networkRole.role) return false;

        const roleName =
          typeof networkRole.role === "object"
            ? networkRole.role.role_name
            : networkRole.role;
        const roleCode =
          typeof networkRole.role === "object"
            ? networkRole.role.role_code
            : null;

        if (!roleName) return false;

        // Check for exact AirQo super admin patterns
        const isAirQoSuper =
          roleName === "AIRQO_SUPER_ADMIN" ||
          roleCode === "AIRQO_SUPER_ADMIN" ||
          (roleName.includes("AIRQO") && roleName.includes("SUPER_ADMIN")) ||
          (roleCode &&
            roleCode.includes("AIRQO") &&
            roleCode.includes("SUPER_ADMIN"));

        if (isAirQoSuper) {
          logger.debug(
            `Found AirQo super admin role in network: ${roleName} (${roleCode})`
          );
          return true;
        }
        return false;
      });
      if (hasAirQoSuper) return true;
    }

    return false;
  }

  /**
   * Check if user has system-wide permissions regardless of context
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async hasSystemWidePermissions(userId) {
    try {
      const userPermissions = await this.getUserPermissions(userId);

      // These permissions indicate system-wide access
      const systemPermissions = [
        "SYSTEM_ADMIN",
        "SUPER_ADMIN",
        "DATABASE_ADMIN",
        "ORG_CREATE",
        "ORG_DELETE",
        "ORG_APPROVE",
        "ORG_REJECT",
      ];

      const hasSystemPerm = systemPermissions.some((permission) =>
        userPermissions.includes(permission)
      );

      if (hasSystemPerm) {
        logger.debug(`User ${userId} has system-wide permissions`);
      }

      return hasSystemPerm;
    } catch (error) {
      logger.error(`Error checking system permissions: ${error.message}`);
      return false;
    }
  }

  /**
   * Get all permissions for a user across all their groups and networks
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of permission strings
   */
  async getUserPermissions(userId) {
    try {
      const cacheKey = `user_perms_${userId}`;
      const now = Date.now();

      // Check cache first
      if (this.permissionCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && expiry > now) {
          logger.debug(`Cache hit for user permissions: ${userId}`);
          return this.permissionCache.get(cacheKey);
        } else {
          this.permissionCache.delete(cacheKey);
          this.cacheExpiry.delete(cacheKey);
        }
      }

      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate({
          path: "group_roles.role",
          populate: {
            path: "role_permissions",
            select: "permission description",
          },
        })
        .populate({
          path: "network_roles.role",
          populate: {
            path: "role_permissions",
            select: "permission description",
          },
        })
        .lean();

      if (!user) {
        logger.warn(`User ${userId} not found`);
        return [];
      }

      const permissions = new Set();

      // Get permissions from group roles
      if (user.group_roles && user.group_roles.length > 0) {
        user.group_roles.forEach((groupRole) => {
          if (groupRole.role && groupRole.role.role_permissions) {
            groupRole.role.role_permissions.forEach((permission) => {
              if (permission.permission) {
                permissions.add(permission.permission);
              }
            });
          }
        });
      }

      // Get permissions from network roles
      if (user.network_roles && user.network_roles.length > 0) {
        user.network_roles.forEach((networkRole) => {
          if (networkRole.role && networkRole.role.role_permissions) {
            networkRole.role.role_permissions.forEach((permission) => {
              if (permission.permission) {
                permissions.add(permission.permission);
              }
            });
          }
        });
      }

      // Check for super admin (has all permissions)
      const isSuperAdmin = this.isSuperAdmin(user);
      const isSystemSuperAdmin = this.hasAirQoSuperAdminRole(user);

      if (isSuperAdmin || isSystemSuperAdmin) {
        const allPermissions = await this.getAllSystemPermissions();
        allPermissions.forEach((permission) => permissions.add(permission));
        logger.debug(`User ${userId} is super admin, granted all permissions`);
      }

      const result = Array.from(permissions);

      // Cache the result
      this.permissionCache.set(cacheKey, result);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      logger.debug(
        `Retrieved ${result.length} permissions for user: ${userId}`
      );
      return result;
    } catch (error) {
      logger.error(`Error getting user permissions: ${error.message}`);
      return [];
    }
  }

  /**
   * Get permissions for a user within a specific context (group or network)
   * @param {string} userId - User ID
   * @param {string} contextId - Group ID or Network ID
   * @param {string} contextType - 'group' or 'network'
   * @returns {Promise<Array>} Array of permission strings
   */
  async getUserPermissionsInContext(userId, contextId, contextType = "group") {
    try {
      const cacheKey = `user_perms_${userId}_${contextType}_${contextId}`;
      const now = Date.now();

      // Check cache first
      if (this.permissionCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && expiry > now) {
          logger.debug(
            `Cache hit for context permissions: ${userId} in ${contextType} ${contextId}`
          );
          return this.permissionCache.get(cacheKey);
        } else {
          this.permissionCache.delete(cacheKey);
          this.cacheExpiry.delete(cacheKey);
        }
      }

      // System super admins get all permissions in any context
      const isSystemSuper = await this.isSystemSuperAdmin(userId);
      if (isSystemSuper) {
        const allPermissions = await this.getAllSystemPermissions();
        this.permissionCache.set(cacheKey, allPermissions);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);
        logger.debug(
          `System super admin ${userId} granted all permissions in ${contextType} ${contextId}`
        );
        return allPermissions;
      }

      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate({
          path: `${contextType}_roles.role`,
          populate: {
            path: "role_permissions",
            select: "permission description",
          },
        })
        .lean();

      if (!user) {
        logger.warn(`User ${userId} not found for context permissions`);
        return [];
      }

      const permissions = new Set();
      const contextRoles =
        contextType === "group" ? user.group_roles : user.network_roles;

      if (contextRoles && contextRoles.length > 0) {
        contextRoles.forEach((roleAssignment) => {
          const roleContextId =
            contextType === "group"
              ? roleAssignment.group
              : roleAssignment.network;

          if (
            roleContextId &&
            roleContextId.toString() === contextId.toString()
          ) {
            if (roleAssignment.role && roleAssignment.role.role_permissions) {
              roleAssignment.role.role_permissions.forEach((permission) => {
                if (permission.permission) {
                  permissions.add(permission.permission);
                }
              });
            }
          }
        });
      }

      // Check for super admin in this context
      const isSuperAdminInContext = await this.isSuperAdminInContext(
        userId,
        contextId,
        contextType
      );
      if (isSuperAdminInContext) {
        const allPermissions = await this.getAllSystemPermissions();
        allPermissions.forEach((permission) => permissions.add(permission));
        logger.debug(
          `User ${userId} is super admin in ${contextType} ${contextId}`
        );
      }

      const result = Array.from(permissions);

      // Cache the result
      this.permissionCache.set(cacheKey, result);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      logger.debug(
        `Retrieved ${result.length} context permissions for user: ${userId} in ${contextType} ${contextId}`
      );
      return result;
    } catch (error) {
      logger.error(
        `Error getting user permissions in context: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Enhanced permission check that considers system super admins
   * @param {string} userId - User ID
   * @param {string|Array} requiredPermissions - Permission(s) to check
   * @param {boolean} requireAll - Whether all permissions are required
   * @param {string} contextId - Optional context (group/network ID)
   * @param {string} contextType - 'group' or 'network'
   * @returns {Promise<boolean>}
   */
  async hasPermission(
    userId,
    requiredPermissions,
    requireAll = false,
    contextId = null,
    contextType = "group"
  ) {
    try {
      // First check if user is system super admin - they bypass all checks
      const isSystemSuper = await this.isSystemSuperAdmin(userId);
      if (isSystemSuper) {
        logger.debug(
          `System super admin ${userId} bypassing permission check for ${requiredPermissions}`
        );
        return true;
      }

      // Continue with normal permission checking
      let userPermissions;

      if (contextId) {
        userPermissions = await this.getUserPermissionsInContext(
          userId,
          contextId,
          contextType
        );
      } else {
        userPermissions = await this.getUserPermissions(userId);
      }

      const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      const normalizedRequired = permissions.map((perm) =>
        this.normalizePermission(perm)
      );

      const normalizedUser = userPermissions.map((perm) =>
        this.normalizePermission(perm)
      );

      let hasPermission;
      if (requireAll) {
        hasPermission = normalizedRequired.every((permission) =>
          normalizedUser.includes(permission)
        );
      } else {
        hasPermission = normalizedRequired.some((permission) =>
          normalizedUser.includes(permission)
        );
      }

      logger.debug(
        `Permission check for user ${userId}: ${
          hasPermission ? "GRANTED" : "DENIED"
        } for ${normalizedRequired.join(", ")}`
      );
      return hasPermission;
    } catch (error) {
      logger.error(`Error checking user permission: ${error.message}`);
      return false;
    }
  }

  /**
   * Enhanced role check that considers system super admins
   * @param {string} userId - User ID
   * @param {string|Array} requiredRoles - Role(s) to check
   * @param {string} contextId - Optional context (group/network ID)
   * @param {string} contextType - 'group' or 'network'
   * @returns {Promise<boolean>}
   */
  async hasRole(
    userId,
    requiredRoles,
    contextId = null,
    contextType = "group"
  ) {
    try {
      // System super admins bypass role checks
      const isSystemSuper = await this.isSystemSuperAdmin(userId);
      if (isSystemSuper) {
        logger.debug(
          `System super admin ${userId} bypassing role check for ${requiredRoles}`
        );
        return true;
      }

      // Continue with normal role checking
      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate(`${contextType}_roles.role`, "role_name role_code")
        .lean();

      if (!user) {
        logger.warn(`User ${userId} not found for role check`);
        return false;
      }

      const userRoles = [];
      const contextRoles =
        contextType === "group" ? user.group_roles : user.network_roles;

      if (contextRoles && contextRoles.length > 0) {
        contextRoles.forEach((roleAssignment) => {
          const roleContextId =
            contextType === "group"
              ? roleAssignment.group
              : roleAssignment.network;

          // If contextId is specified, only check roles in that context
          if (
            !contextId ||
            (roleContextId && roleContextId.toString() === contextId.toString())
          ) {
            if (roleAssignment.role && roleAssignment.role.role_name) {
              userRoles.push(roleAssignment.role.role_name);
              if (roleAssignment.role.role_code) {
                userRoles.push(roleAssignment.role.role_code);
              }
            }
          }
        });
      }

      const roles = Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles];

      const hasRole = roles.some((role) => {
        const normalizedRole = role.toUpperCase();
        return userRoles.some((userRole) => {
          const normalizedUserRole = userRole.toUpperCase();
          return (
            normalizedUserRole === normalizedRole ||
            normalizedUserRole.includes(normalizedRole) ||
            normalizedRole.includes(normalizedUserRole)
          );
        });
      });

      logger.debug(
        `Role check for user ${userId}: ${
          hasRole ? "GRANTED" : "DENIED"
        } for ${roles.join(", ")} in ${contextType} ${contextId || "global"}`
      );
      return hasRole;
    } catch (error) {
      logger.error(`Error checking user role: ${error.message}`);
      return false;
    }
  }

  /**
   * Enhanced group membership check for system super admins
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>}
   */
  async isGroupMember(userId, groupId) {
    try {
      // System super admins are considered members of all groups
      const isSystemSuper = await this.isSystemSuperAdmin(userId);
      if (isSystemSuper) {
        logger.debug(
          `System super admin ${userId} granted access to group ${groupId}`
        );
        return true;
      }

      // Normal membership check
      const user = await UserModel(this.tenant).findById(userId).lean();

      if (!user || !user.group_roles) {
        logger.debug(`User ${userId} not found or has no group roles`);
        return false;
      }

      const isMember = user.group_roles.some(
        (groupRole) =>
          groupRole.group && groupRole.group.toString() === groupId.toString()
      );

      logger.debug(
        `Group membership check for user ${userId} in group ${groupId}: ${
          isMember ? "MEMBER" : "NOT_MEMBER"
        }`
      );
      return isMember;
    } catch (error) {
      logger.error(`Error checking group membership: ${error.message}`);
      return false;
    }
  }

  /**
   * Enhanced network membership check for system super admins
   * @param {string} userId - User ID
   * @param {string} networkId - Network ID
   * @returns {Promise<boolean>}
   */
  async isNetworkMember(userId, networkId) {
    try {
      // System super admins are considered members of all networks
      const isSystemSuper = await this.isSystemSuperAdmin(userId);
      if (isSystemSuper) {
        logger.debug(
          `System super admin ${userId} granted access to network ${networkId}`
        );
        return true;
      }

      // Normal membership check
      const user = await UserModel(this.tenant).findById(userId).lean();

      if (!user || !user.network_roles) {
        logger.debug(`User ${userId} not found or has no network roles`);
        return false;
      }

      const isMember = user.network_roles.some(
        (networkRole) =>
          networkRole.network &&
          networkRole.network.toString() === networkId.toString()
      );

      logger.debug(
        `Network membership check for user ${userId} in network ${networkId}: ${
          isMember ? "MEMBER" : "NOT_MEMBER"
        }`
      );
      return isMember;
    } catch (error) {
      logger.error(`Error checking network membership: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user is a group manager
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>}
   */
  async isGroupManager(userId, groupId) {
    try {
      // System super admins are considered managers of all groups
      const isSystemSuper = await this.isSystemSuperAdmin(userId);
      if (isSystemSuper) {
        logger.debug(
          `System super admin ${userId} granted manager access to group ${groupId}`
        );
        return true;
      }

      const group = await GroupModel(this.tenant).findById(groupId).lean();

      if (!group) {
        logger.warn(`Group ${groupId} not found for manager check`);
        return false;
      }

      const isManager =
        group.grp_manager && group.grp_manager.toString() === userId.toString();
      logger.debug(
        `Group manager check for user ${userId} in group ${groupId}: ${
          isManager ? "MANAGER" : "NOT_MANAGER"
        }`
      );
      return isManager;
    } catch (error) {
      logger.error(`Error checking group manager status: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user is a super admin (legacy method)
   * @param {Object} user - User object
   * @returns {boolean}
   */
  isSuperAdmin(user) {
    if (!user) {
      return false;
    }

    // Check for AirQo super admin first
    if (this.hasAirQoSuperAdminRole(user)) {
      return true;
    }

    // Check group roles for super admin
    if (user.group_roles && user.group_roles.length > 0) {
      const hasGroupSuperAdminRole = user.group_roles.some((groupRole) => {
        if (!groupRole.role) return false;
        const roleName =
          typeof groupRole.role === "object"
            ? groupRole.role.role_name
            : groupRole.role;
        return (
          roleName &&
          (roleName.includes("SUPER_ADMIN") ||
            roleName === "super_admin" ||
            roleName === "SUPER_ADMIN")
        );
      });
      if (hasGroupSuperAdminRole) return true;
    }

    // Check network roles for super admin
    if (user.network_roles && user.network_roles.length > 0) {
      const hasNetworkSuperAdminRole = user.network_roles.some(
        (networkRole) => {
          if (!networkRole.role) return false;
          const roleName =
            typeof networkRole.role === "object"
              ? networkRole.role.role_name
              : networkRole.role;
          return (
            roleName &&
            (roleName.includes("SUPER_ADMIN") ||
              roleName === "super_admin" ||
              roleName === "SUPER_ADMIN")
          );
        }
      );
      if (hasNetworkSuperAdminRole) return true;
    }

    return false;
  }

  /**
   * Check if user is a super admin in specific context
   * @param {string} userId - User ID
   * @param {string} contextId - Group ID or Network ID
   * @param {string} contextType - 'group' or 'network'
   * @returns {Promise<boolean>}
   */
  async isSuperAdminInContext(userId, contextId, contextType = "group") {
    try {
      // System super admins are super admins in all contexts
      const isSystemSuper = await this.isSystemSuperAdmin(userId);
      if (isSystemSuper) {
        logger.debug(
          `System super admin ${userId} is super admin in ${contextType} ${contextId}`
        );
        return true;
      }

      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate(`${contextType}_roles.role`, "role_name role_code")
        .lean();

      if (!user) {
        logger.warn(`User ${userId} not found for context super admin check`);
        return false;
      }

      const contextRoles =
        contextType === "group" ? user.group_roles : user.network_roles;

      if (contextRoles && contextRoles.length > 0) {
        const isSuperInContext = contextRoles.some((roleAssignment) => {
          const roleContextId =
            contextType === "group"
              ? roleAssignment.group
              : roleAssignment.network;

          if (
            roleContextId &&
            roleContextId.toString() === contextId.toString()
          ) {
            if (roleAssignment.role && roleAssignment.role.role_name) {
              return (
                roleAssignment.role.role_name.includes("SUPER_ADMIN") ||
                (roleAssignment.role.role_code &&
                  roleAssignment.role.role_code.includes("SUPER_ADMIN"))
              );
            }
          }
          return false;
        });

        logger.debug(
          `Super admin in context check for user ${userId} in ${contextType} ${contextId}: ${
            isSuperInContext ? "YES" : "NO"
          }`
        );
        return isSuperInContext;
      }

      return false;
    } catch (error) {
      logger.error(`Error checking super admin in context: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user can perform an action based on resource ownership
   * @param {string} userId - User ID
   * @param {Object} resource - Resource object with owner information
   * @param {Function} ownerExtractor - Function to extract owner ID from resource
   * @returns {Promise<boolean>}
   */
  async canAccessResource(userId, resource, ownerExtractor) {
    try {
      // System super admins can access any resource
      const isSystemSuper = await this.isSystemSuperAdmin(userId);
      if (isSystemSuper) {
        logger.debug(`System super admin ${userId} can access any resource`);
        return true;
      }

      // Check ownership
      const ownerId = ownerExtractor(resource);
      const isOwner = ownerId && ownerId.toString() === userId.toString();

      logger.debug(
        `Resource access check for user ${userId}: ${
          isOwner ? "OWNER" : "NOT_OWNER"
        }`
      );
      return isOwner;
    } catch (error) {
      logger.error(`Error checking resource access: ${error.message}`);
      return false;
    }
  }

  /**
   * Normalize permission string
   * @param {string} permission - Permission to normalize
   * @returns {string} Normalized permission
   */
  normalizePermission(permission) {
    if (!permission || typeof permission !== "string") {
      return "";
    }

    if (permission.includes(":")) {
      return permission.replace(":", "_").toUpperCase();
    }
    return permission.toUpperCase();
  }

  /**
   * Get all system permissions with caching
   * @returns {Promise<Array>} Array of all permission strings
   */
  async getAllSystemPermissions() {
    try {
      const now = Date.now();

      // Check system permissions cache
      if (
        this.systemPermissionsCache &&
        this.systemPermissionsCache.expiry > now
      ) {
        logger.debug("Cache hit for all system permissions");
        return this.systemPermissionsCache.permissions;
      }

      const permissions = await PermissionModel(this.tenant)
        .find({})
        .select("permission")
        .lean();

      const permissionStrings = permissions.map((p) => p.permission);

      // Cache system permissions for longer period
      this.systemPermissionsCache = {
        permissions: permissionStrings,
        expiry: now + this.SYSTEM_CACHE_TTL,
      };

      logger.debug(`Retrieved ${permissionStrings.length} system permissions`);
      return permissionStrings;
    } catch (error) {
      logger.error(`Error getting all permissions: ${error.message}`);
      return [];
    }
  }

  /**
   * Get roles for a user in a specific context
   * @param {string} userId - User ID
   * @param {string} contextId - Group or Network ID
   * @param {string} contextType - 'group' or 'network'
   * @returns {Promise<Array>} Array of role objects
   */
  async getUserRolesInContext(userId, contextId, contextType = "group") {
    try {
      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate(`${contextType}_roles.role`)
        .lean();

      if (!user) {
        return [];
      }

      const contextRoles =
        contextType === "group" ? user.group_roles : user.network_roles;
      const rolesInContext = [];

      if (contextRoles && contextRoles.length > 0) {
        contextRoles.forEach((roleAssignment) => {
          const roleContextId =
            contextType === "group"
              ? roleAssignment.group
              : roleAssignment.network;

          if (
            roleContextId &&
            roleContextId.toString() === contextId.toString() &&
            roleAssignment.role
          ) {
            rolesInContext.push(roleAssignment.role);
          }
        });
      }

      return rolesInContext;
    } catch (error) {
      logger.error(`Error getting user roles in context: ${error.message}`);
      return [];
    }
  }

  /**
   * Check if user has any of the specified permissions in any context
   * @param {string} userId - User ID
   * @param {Array} permissions - Array of permission strings
   * @returns {Promise<boolean>}
   */
  async hasAnyPermission(userId, permissions) {
    try {
      return await this.hasPermission(userId, permissions, false);
    } catch (error) {
      logger.error(`Error checking any permission: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user has all of the specified permissions
   * @param {string} userId - User ID
   * @param {Array} permissions - Array of permission strings
   * @returns {Promise<boolean>}
   */
  async hasAllPermissions(userId, permissions) {
    try {
      return await this.hasPermission(userId, permissions, true);
    } catch (error) {
      logger.error(`Error checking all permissions: ${error.message}`);
      return false;
    }
  }

  /**
   * Get user's effective permissions across all contexts
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Object with grouped permissions
   */
  async getUserEffectivePermissions(userId) {
    try {
      const [globalPermissions, user] = await Promise.all([
        this.getUserPermissions(userId),
        UserModel(this.tenant)
          .findById(userId)
          .populate("group_roles.role group_roles.group")
          .populate("network_roles.role network_roles.network")
          .lean(),
      ]);

      const result = {
        global_permissions: globalPermissions,
        group_permissions: {},
        network_permissions: {},
        is_system_super_admin: await this.isSystemSuperAdmin(userId),
      };

      if (user) {
        // Group permissions by context
        if (user.group_roles) {
          for (const groupRole of user.group_roles) {
            if (groupRole.group && groupRole.group._id) {
              const groupPerms = await this.getUserPermissionsInContext(
                userId,
                groupRole.group._id,
                "group"
              );
              result.group_permissions[groupRole.group._id] = {
                group_name: groupRole.group.grp_title,
                permissions: groupPerms,
                role: groupRole.role
                  ? {
                      id: groupRole.role._id,
                      name: groupRole.role.role_name,
                    }
                  : null,
              };
            }
          }
        }

        // Network permissions by context
        if (user.network_roles) {
          for (const networkRole of user.network_roles) {
            if (networkRole.network && networkRole.network._id) {
              const networkPerms = await this.getUserPermissionsInContext(
                userId,
                networkRole.network._id,
                "network"
              );
              result.network_permissions[networkRole.network._id] = {
                network_name: networkRole.network.net_name,
                permissions: networkPerms,
                role: networkRole.role
                  ? {
                      id: networkRole.role._id,
                      name: networkRole.role.role_name,
                    }
                  : null,
              };
            }
          }
        }
      }

      return result;
    } catch (error) {
      logger.error(`Error getting effective permissions: ${error.message}`);
      return {
        global_permissions: [],
        group_permissions: {},
        network_permissions: {},
        is_system_super_admin: false,
      };
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.permissionCache.clear();
    this.roleCache.clear();
    this.userCache.clear();
    this.cacheExpiry.clear();
    this.systemPermissionsCache = null;
    logger.info("RBAC cache cleared completely");
  }

  /**
   * Clear cache for a specific user
   * @param {string} userId - User ID to clear cache for
   */
  clearUserCache(userId) {
    if (!userId) {
      logger.warn("clearUserCache called without userId");
      return;
    }

    const userIdStr = userId.toString();
    let clearedCount = 0;

    // Clear entries that match this user ID
    for (const [key] of this.permissionCache) {
      if (key.includes(userIdStr)) {
        this.permissionCache.delete(key);
        this.cacheExpiry.delete(key);
        clearedCount++;
      }
    }

    for (const [key] of this.roleCache) {
      if (key.includes(userIdStr)) {
        this.roleCache.delete(key);
        this.cacheExpiry.delete(key);
        clearedCount++;
      }
    }

    for (const [key] of this.userCache) {
      if (key.includes(userIdStr)) {
        this.userCache.delete(key);
        this.cacheExpiry.delete(key);
        clearedCount++;
      }
    }

    logger.info(
      `RBAC cache cleared for user: ${userIdStr} (${clearedCount} entries)`
    );
  }

  /**
   * Clear cache for all users in a specific group
   * @param {string} groupId - Group ID to clear cache for
   */
  async clearGroupCache(groupId) {
    if (!groupId) {
      logger.warn("clearGroupCache called without groupId");
      return;
    }

    try {
      // Get all users in the group
      const groupUsers = await UserModel(this.tenant)
        .find({ "group_roles.group": groupId })
        .select("_id")
        .lean();

      // Clear cache for each user in the group
      groupUsers.forEach((user) => {
        this.clearUserCache(user._id);
      });

      logger.info(
        `RBAC cache cleared for group: ${groupId} (${groupUsers.length} users affected)`
      );
    } catch (error) {
      logger.error(
        `Error clearing group cache for ${groupId}: ${error.message}`
      );
    }
  }

  /**
   * Clear cache for all users in a specific network
   * @param {string} networkId - Network ID to clear cache for
   */
  async clearNetworkCache(networkId) {
    if (!networkId) {
      logger.warn("clearNetworkCache called without networkId");
      return;
    }

    try {
      // Get all users in the network
      const networkUsers = await UserModel(this.tenant)
        .find({ "network_roles.network": networkId })
        .select("_id")
        .lean();

      // Clear cache for each user in the network
      networkUsers.forEach((user) => {
        this.clearUserCache(user._id);
      });

      logger.info(
        `RBAC cache cleared for network: ${networkId} (${networkUsers.length} users affected)`
      );
    } catch (error) {
      logger.error(
        `Error clearing network cache for ${networkId}: ${error.message}`
      );
    }
  }

  /**
   * Clear cache for a specific permission
   * @param {string} permission - Permission to clear cache for
   */
  clearPermissionCache(permission) {
    if (!permission) {
      logger.warn("clearPermissionCache called without permission");
      return;
    }

    let clearedCount = 0;
    const normalizedPermission = this.normalizePermission(permission);

    // Clear all user permission caches since permission changed
    for (const [key] of this.permissionCache) {
      if (key.includes("user_perms_")) {
        this.permissionCache.delete(key);
        this.cacheExpiry.delete(key);
        clearedCount++;
      }
    }

    // Clear system permissions cache
    this.systemPermissionsCache = null;

    logger.info(
      `Permission cache cleared for: ${normalizedPermission} (${clearedCount} entries)`
    );
  }

  /**
   * Clear cache for a specific role
   * @param {string} roleId - Role ID to clear cache for
   */
  async clearRoleCache(roleId) {
    if (!roleId) {
      logger.warn("clearRoleCache called without roleId");
      return;
    }

    try {
      // Find all users with this role
      const usersWithRole = await UserModel(this.tenant)
        .find({
          $or: [
            { "group_roles.role": roleId },
            { "network_roles.role": roleId },
          ],
        })
        .select("_id")
        .lean();

      // Clear cache for each affected user
      usersWithRole.forEach((user) => {
        this.clearUserCache(user._id);
      });

      logger.info(
        `Role cache cleared for role: ${roleId} (${usersWithRole.length} users affected)`
      );
    } catch (error) {
      logger.error(`Error clearing role cache for ${roleId}: ${error.message}`);
    }
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;

    // Clean permission cache
    for (const [key, expiry] of this.cacheExpiry) {
      if (expiry && expiry < now) {
        this.permissionCache.delete(key);
        this.roleCache.delete(key);
        this.userCache.delete(key);
        this.cacheExpiry.delete(key);
        cleanedCount++;
      }
    }

    // Clean system permissions cache if expired
    if (
      this.systemPermissionsCache &&
      this.systemPermissionsCache.expiry < now
    ) {
      this.systemPermissionsCache = null;
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      logger.debug(`Cleaned ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Get cache statistics for monitoring
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, expiry] of this.cacheExpiry) {
      if (expiry && expiry < now) {
        expiredCount++;
      }
    }

    return {
      permission_cache_size: this.permissionCache.size,
      role_cache_size: this.roleCache.size,
      user_cache_size: this.userCache.size,
      total_cache_entries: this.cacheExpiry.size,
      expired_entries: expiredCount,
      system_permissions_cached: !!this.systemPermissionsCache,
      cache_ttl_minutes: this.CACHE_TTL / (60 * 1000),
      system_cache_ttl_minutes: this.SYSTEM_CACHE_TTL / (60 * 1000),
    };
  }

  /**
   * Enhanced debug user permissions for troubleshooting
   * @param {string} userId - User ID to debug
   * @returns {Promise<Object>} Comprehensive debug information
   */
  async debugUserPermissions(userId) {
    try {
      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate({
          path: "group_roles.role",
          populate: {
            path: "role_permissions",
            select: "permission description",
          },
        })
        .populate({
          path: "network_roles.role",
          populate: {
            path: "role_permissions",
            select: "permission description",
          },
        })
        .populate("group_roles.group", "grp_title grp_status")
        .populate("network_roles.network", "net_name")
        .lean();

      if (!user) {
        return { error: "User not found", userId };
      }

      const groupRoles = user.group_roles || [];
      const networkRoles = user.network_roles || [];

      const groupPermissions = new Set();
      const networkPermissions = new Set();

      groupRoles.forEach((groupRole) => {
        if (groupRole.role && groupRole.role.role_permissions) {
          groupRole.role.role_permissions.forEach((p) =>
            groupPermissions.add(p.permission)
          );
        }
      });

      networkRoles.forEach((networkRole) => {
        if (networkRole.role && networkRole.role.role_permissions) {
          networkRole.role.role_permissions.forEach((p) =>
            networkPermissions.add(p.permission)
          );
        }
      });

      const isSuperAdmin = this.isSuperAdmin(user);
      const isSystemSuperAdmin = await this.isSystemSuperAdmin(userId);
      const hasAirQoSuperAdmin = this.hasAirQoSuperAdminRole(user);

      // Get effective permissions
      const effectivePermissions = await this.getUserEffectivePermissions(
        userId
      );

      return {
        userId,
        user_info: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
          verified: user.verified,
        },
        admin_status: {
          isSuperAdmin,
          isSystemSuperAdmin,
          hasAirQoSuperAdmin,
        },
        role_assignments: {
          groupRoles: groupRoles.map((gr) => ({
            group: gr.group
              ? {
                  id: gr.group._id,
                  title: gr.group.grp_title,
                  status: gr.group.grp_status,
                }
              : null,
            role: gr.role
              ? {
                  id: gr.role._id,
                  name: gr.role.role_name,
                  code: gr.role.role_code,
                  permissions_count: gr.role.role_permissions?.length || 0,
                }
              : null,
            userType: gr.userType,
            createdAt: gr.createdAt,
          })),
          networkRoles: networkRoles.map((nr) => ({
            network: nr.network
              ? {
                  id: nr.network._id,
                  name: nr.network.net_name,
                }
              : null,
            role: nr.role
              ? {
                  id: nr.role._id,
                  name: nr.role.role_name,
                  code: nr.role.role_code,
                  permissions_count: nr.role.role_permissions?.length || 0,
                }
              : null,
            userType: nr.userType,
            createdAt: nr.createdAt,
          })),
        },
        permissions: {
          groupPermissions: Array.from(groupPermissions),
          networkPermissions: Array.from(networkPermissions),
          allPermissions: await this.getUserPermissions(userId),
          effectivePermissions,
        },
        cache_info: {
          has_cached_permissions: this.permissionCache.has(
            `user_perms_${userId}`
          ),
          cache_stats: this.getCacheStats(),
        },
        system_info: {
          tenant: this.tenant,
          total_system_permissions: (await this.getAllSystemPermissions())
            .length,
          debug_timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error(`Error debugging user permissions: ${error.message}`);
      return {
        error: error.message,
        userId,
        debug_timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Validate user access to multiple resources at once
   * @param {string} userId - User ID
   * @param {Array} resources - Array of {contextType, contextId, requiredPermissions}
   * @returns {Promise<Object>} Access results for each resource
   */
  async validateMultipleAccess(userId, resources) {
    try {
      const isSystemSuper = await this.isSystemSuperAdmin(userId);

      const results = await Promise.all(
        resources.map(async (resource) => {
          const { contextType, contextId, requiredPermissions } = resource;

          if (isSystemSuper) {
            return {
              contextType,
              contextId,
              access: true,
              reason: "System Super Admin",
              permissions: await this.getAllSystemPermissions(),
            };
          }

          const hasAccess = await this.hasPermission(
            userId,
            requiredPermissions,
            false,
            contextId,
            contextType
          );

          const userPermissions = await this.getUserPermissionsInContext(
            userId,
            contextId,
            contextType
          );

          return {
            contextType,
            contextId,
            access: hasAccess,
            reason: hasAccess
              ? "Has required permissions"
              : "Insufficient permissions",
            requiredPermissions,
            userPermissions,
          };
        })
      );

      return {
        userId,
        isSystemSuperAdmin: isSystemSuper,
        accessResults: results,
        summary: {
          total: results.length,
          granted: results.filter((r) => r.access).length,
          denied: results.filter((r) => !r.access).length,
        },
      };
    } catch (error) {
      logger.error(`Error validating multiple access: ${error.message}`);
      return {
        userId,
        error: error.message,
        accessResults: [],
      };
    }
  }

  /**
   * Get user summary for admin interfaces
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User summary with role and permission info
   */
  async getUserSummary(userId) {
    try {
      const [user, debugInfo] = await Promise.all([
        UserModel(this.tenant).findById(userId).lean(),
        this.debugUserPermissions(userId),
      ]);

      if (!user) {
        return { error: "User not found" };
      }

      return {
        user: {
          id: userId,
          email: user.email,
          name: `${user.firstName} ${user.lastName}`,
          isActive: user.isActive,
          verified: user.verified,
        },
        access_summary: {
          isSystemSuperAdmin:
            debugInfo.admin_status?.isSystemSuperAdmin || false,
          totalGroups: debugInfo.role_assignments?.groupRoles?.length || 0,
          totalNetworks: debugInfo.role_assignments?.networkRoles?.length || 0,
          totalPermissions: debugInfo.permissions?.allPermissions?.length || 0,
        },
        quick_access: {
          canManageUsers: await this.hasPermission(userId, ["USER_MANAGEMENT"]),
          canManageGroups: await this.hasPermission(userId, [
            "GROUP_MANAGEMENT",
          ]),
          canViewAnalytics: await this.hasPermission(userId, [
            "ANALYTICS_VIEW",
          ]),
          canManageSystem: await this.hasPermission(userId, ["SYSTEM_ADMIN"]),
        },
      };
    } catch (error) {
      logger.error(`Error getting user summary: ${error.message}`);
      return { error: error.message };
    }
  }

  async getUserGroupRoles(userId) {
    try {
      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate("group_roles.group")
        .populate("group_roles.role")
        .lean();

      if (!user) return [];

      return user.group_roles || [];
    } catch (error) {
      logger.error(`Error getting user group roles: ${error.message}`);
      return [];
    }
  }

  async getUserNetworkRoles(userId) {
    try {
      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate("network_roles.network")
        .populate("network_roles.role")
        .lean();

      if (!user) return [];

      return user.network_roles || [];
    } catch (error) {
      logger.error(`Error getting user network roles: ${error.message}`);
      return [];
    }
  }

  // Get simplified permission structure for JWT
  async getUserAccessSummary(userId) {
    try {
      const [groupRoles, networkRoles] = await Promise.all([
        this.getUserGroupRoles(userId),
        this.getUserNetworkRoles(userId),
      ]);

      const summary = {
        groups: {},
        networks: {},
        isSuperAdmin: false,
      };

      // Process groups
      for (const gr of groupRoles) {
        if (gr.group && gr.role) {
          summary.groups[gr.group._id] = {
            name: gr.group.grp_title,
            roleCode: gr.role.role_code,
            roleName: gr.role.role_name,
          };

          if (gr.role.role_code?.includes("SUPER_ADMIN")) {
            summary.isSuperAdmin = true;
          }
        }
      }

      // Process networks
      for (const nr of networkRoles) {
        if (nr.network && nr.role) {
          summary.networks[nr.network._id] = {
            name: nr.network.net_name,
            roleCode: nr.role.role_code,
            roleName: nr.role.role_name,
          };
        }
      }

      return summary;
    } catch (error) {
      logger.error(`Error getting user access summary: ${error.message}`);
      return { groups: {}, networks: {}, isSuperAdmin: false };
    }
  }
}

module.exports = RBACService;
