// services/rbac.service.js
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
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    // Set up periodic cache cleanup (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 5 * 60 * 1000);
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get all permissions for a user across all their groups and networks
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of permission strings
   */
  async getUserPermissions(userId) {
    try {
      const cacheKey = userId.toString();
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
      if (isSuperAdmin) {
        const allPermissions = await this.getAllSystemPermissions();
        allPermissions.forEach((permission) => permissions.add(permission));
      }

      const result = Array.from(permissions);

      // Cache the result
      this.permissionCache.set(cacheKey, result);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      logger.debug(`Cached permissions for user: ${userId}`);
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
      const cacheKey = `${userId}_${contextType}_${contextId}`;
      const now = Date.now();

      // Check cache first
      if (this.permissionCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && expiry > now) {
          return this.permissionCache.get(cacheKey);
        } else {
          this.permissionCache.delete(cacheKey);
          this.cacheExpiry.delete(cacheKey);
        }
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
      }

      const result = Array.from(permissions);

      // Cache the result
      this.permissionCache.set(cacheKey, result);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      return result;
    } catch (error) {
      logger.error(
        `Error getting user permissions in context: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Check if user has specific permissions
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

      if (requireAll) {
        return normalizedRequired.every((permission) =>
          userPermissions.includes(permission)
        );
      } else {
        return normalizedRequired.some((permission) =>
          userPermissions.includes(permission)
        );
      }
    } catch (error) {
      logger.error(`Error checking user permission: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user has specific roles
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
      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate(`${contextType}_roles.role`, "role_name")
        .lean();

      if (!user) {
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
            }
          }
        });
      }

      const roles = Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles];

      return roles.some((role) => {
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
    } catch (error) {
      logger.error(`Error checking user role: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user is a member of a specific group
   * @param {string} userId - User ID
   * @param {string} groupId - Group ID
   * @returns {Promise<boolean>}
   */
  async isGroupMember(userId, groupId) {
    try {
      const user = await UserModel(this.tenant).findById(userId).lean();

      if (!user || !user.group_roles) {
        return false;
      }

      return user.group_roles.some(
        (groupRole) =>
          groupRole.group && groupRole.group.toString() === groupId.toString()
      );
    } catch (error) {
      logger.error(`Error checking group membership: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user is a member of a specific network
   * @param {string} userId - User ID
   * @param {string} networkId - Network ID
   * @returns {Promise<boolean>}
   */
  async isNetworkMember(userId, networkId) {
    try {
      const user = await UserModel(this.tenant).findById(userId).lean();

      if (!user || !user.network_roles) {
        return false;
      }

      return user.network_roles.some(
        (networkRole) =>
          networkRole.network &&
          networkRole.network.toString() === networkId.toString()
      );
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
      const group = await GroupModel(this.tenant).findById(groupId).lean();

      if (!group) {
        return false;
      }

      return (
        group.grp_manager && group.grp_manager.toString() === userId.toString()
      );
    } catch (error) {
      logger.error(`Error checking group manager status: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if user is a super admin
   * @param {Object} user - User object
   * @returns {boolean}
   */
  isSuperAdmin(user) {
    if (!user) {
      return false;
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
      const user = await UserModel(this.tenant)
        .findById(userId)
        .populate(`${contextType}_roles.role`, "role_name")
        .lean();

      if (!user) {
        return false;
      }

      const contextRoles =
        contextType === "group" ? user.group_roles : user.network_roles;

      if (contextRoles && contextRoles.length > 0) {
        return contextRoles.some((roleAssignment) => {
          const roleContextId =
            contextType === "group"
              ? roleAssignment.group
              : roleAssignment.network;

          if (
            roleContextId &&
            roleContextId.toString() === contextId.toString()
          ) {
            if (roleAssignment.role && roleAssignment.role.role_name) {
              return roleAssignment.role.role_name.includes("SUPER_ADMIN");
            }
          }
          return false;
        });
      }

      return false;
    } catch (error) {
      logger.error(`Error checking super admin in context: ${error.message}`);
      return false;
    }
  }

  /**
   * Normalize permission string
   * @param {string} permission - Permission to normalize
   * @returns {string} Normalized permission
   */
  normalizePermission(permission) {
    if (permission.includes(":")) {
      return permission.replace(":", "_").toUpperCase();
    }
    return permission.toUpperCase();
  }

  /**
   * Get all system permissions
   * @returns {Promise<Array>} Array of all permission strings
   */
  async getAllSystemPermissions() {
    try {
      const permissions = await PermissionModel(this.tenant)
        .find({})
        .select("permission")
        .lean();

      return permissions.map((p) => p.permission);
    } catch (error) {
      logger.error(`Error getting all permissions: ${error.message}`);
      return [];
    }
  }

  /**
   * Clear all cache
   */
  clearCache() {
    this.permissionCache.clear();
    this.roleCache.clear();
    this.cacheExpiry.clear();
    logger.info("RBAC cache cleared");
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

    // Clear entries that match this user ID
    for (const [key] of this.permissionCache) {
      if (key.includes(userIdStr)) {
        this.permissionCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }

    for (const [key] of this.roleCache) {
      if (key.includes(userIdStr)) {
        this.roleCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }

    logger.info(`RBAC cache cleared for user: ${userIdStr}`);
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
   * Clean expired cache entries
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, expiry] of this.cacheExpiry) {
      if (expiry && expiry < now) {
        this.permissionCache.delete(key);
        this.roleCache.delete(key);
        this.cacheExpiry.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Debug user permissions for troubleshooting
   * @param {string} userId - User ID to debug
   * @returns {Promise<Object>} Debug information
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
        .populate("group_roles.group", "grp_title")
        .populate("network_roles.network", "net_name")
        .lean();

      if (!user) {
        return { error: "User not found" };
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

      return {
        userId,
        isSuperAdmin,
        groupRoles: groupRoles.map((gr) => ({
          group: gr.group,
          role: gr.role ? { id: gr.role._id, name: gr.role.role_name } : null,
          userType: gr.userType,
          createdAt: gr.createdAt,
        })),
        networkRoles: networkRoles.map((nr) => ({
          network: nr.network,
          role: nr.role ? { id: nr.role._id, name: nr.role.role_name } : null,
          userType: nr.userType,
          createdAt: nr.createdAt,
        })),
        groupPermissions: Array.from(groupPermissions),
        networkPermissions: Array.from(networkPermissions),
        allPermissions: await this.getUserPermissions(userId),
      };
    } catch (error) {
      logger.error(`Error debugging user permissions: ${error.message}`);
      return { error: error.message };
    }
  }
}

module.exports = RBACService;
