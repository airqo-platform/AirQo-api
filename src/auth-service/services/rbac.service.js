// services/rbac.service.js
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- rbac-service`
);
const {
  isGroupActivationMigrationComplete,
} = require("@bin/jobs/default-group-init-job");

const { logText, logObject } = require("@utils/shared");

// ── Redis RBAC permission cache (L2 — shared across all replicas) ──────────
// Each login calls getUserPermissionsForLogin() which runs 3-5 parallel DB
// queries. Caching in Redis means only the first login per user per replica
// per TTL window hits the database. The in-process Map below is L1 (faster,
// per-replica). Both caches are optional and fail safe to a DB lookup.
//
// Redis key format:  airqo:rbac:<tenant>:<userId>
// TTL:              5 minutes — short enough that role changes propagate
//                  within a reasonable window without a manual invalidation.
const REDIS_RBAC_TTL = 5 * 60; // seconds

const _redisGet = async (key) => {
  try {
    const { redis: redisClient } = require("@config/redis");
    if (!redisClient || !redisClient.isOpen || !redisClient.isReady) return null;
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null; // Redis unavailable — fall through to DB
  }
};

const _redisSet = async (key, value, ttlSeconds) => {
  try {
    const { redis: redisClient } = require("@config/redis");
    if (!redisClient || !redisClient.isOpen || !redisClient.isReady) return;
    await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (_) {
    // Redis unavailable — continue without caching
  }
};

const _redisDel = async (key) => {
  try {
    const { redis: redisClient } = require("@config/redis");
    if (!redisClient || !redisClient.isOpen || !redisClient.isReady) return;
    await redisClient.del(key);
  } catch (_) {
    // Redis unavailable — safe to ignore
  }
};

/**
 * Invalidates the L2 Redis RBAC cache for a single user.
 * Call this whenever a user's group/network membership or group status changes
 * so the next getUserPermissionsForLogin() call rebuilds from the DB instead of
 * returning a stale cached payload.
 *
 * @param {string} userId
 * @param {string} [tenant="airqo"]
 */
const invalidateUserRBACCache = (userId, tenant = "airqo") =>
  _redisDel(`airqo:rbac:${tenant}:${userId}`);

class RBACService {
  constructor(tenant = "airqo") {
    this.tenant = tenant;
    this.rolePermissionCache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes (L1 in-process cache)

    // Set up periodic cache cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 5 * 60 * 1000);
    if (
      this.cleanupInterval &&
      typeof this.cleanupInterval.unref === "function"
    ) {
      this.cleanupInterval.unref();
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  getUserModel() {
    const UserModel = require("@models/User");
    return UserModel(this.tenant);
  }

  getGroupModel() {
    const GroupModel = require("@models/Group");
    return GroupModel(this.tenant);
  }

  getNetworkModel() {
    const NetworkModel = require("@models/Network");
    return NetworkModel(this.tenant);
  }

  getRoleModel() {
    const RoleModel = require("@models/Role");
    return RoleModel(this.tenant);
  }

  getPermissionModel() {
    const PermissionModel = require("@models/Permission");
    return PermissionModel(this.tenant);
  }

  /**
   * Manually populate user role and permission data to avoid schema registration issues
   */
  async _populateUserRoleData(user) {
    try {
      const populatedUser = { ...user };

      // All population operations can run in parallel since they're independent
      const [directPermissions, populatedGroupRoles, populatedNetworkRoles] =
        await Promise.all([
          this._populateDirectPermissions(user),
          this._populateGroupRoles(user.group_roles),
          this._populateNetworkRoles(user.network_roles),
        ]);

      // Assign populated data
      populatedUser.permissions = directPermissions;
      populatedUser.group_roles = populatedGroupRoles;
      populatedUser.network_roles = populatedNetworkRoles;

      return populatedUser;
    } catch (error) {
      console.error("Error in optimized manual population:", error);
      return user; // Return original user if population fails
    }
  }

  async getUserPermissions(userId) {
    try {
      const cacheKey = userId.toString();
      const now = Date.now();

      // Check cache first
      if (this.rolePermissionCache.has(cacheKey)) {
        const expiry = this.cacheExpiry.get(cacheKey);
        if (expiry && expiry > now) {
          logger.debug(`Cache hit for user permissions: ${userId}`);
          return this.rolePermissionCache.get(cacheKey);
        } else {
          this.rolePermissionCache.delete(cacheKey);
          this.cacheExpiry.delete(cacheKey);
        }
      }

      console.log("🔍 Enhanced RBAC: Getting permissions for user:", userId);

      // Get user without populate first
      const user = await this.getUserModel().findById(userId).lean();

      if (!user) {
        console.log("❌ Enhanced RBAC: User not found:", userId);
        return [];
      }

      // Manually populate the user data
      const populatedUser = await this._populateUserRoleData(user);

      const allPermissions = new Set();

      // Add default permissions based on user type (with fallback)
      const userType = populatedUser.userType || "user"; // Fallback to "user" if undefined
      const defaultPermissions = this.getDefaultPermissionsByUserType(userType);
      defaultPermissions.forEach((permission) =>
        allPermissions.add(permission)
      );

      // Add direct user permissions
      if (populatedUser.permissions && populatedUser.permissions.length > 0) {
        console.log(
          `📋 Enhanced RBAC: Processing ${populatedUser.permissions.length} direct permissions`
        );
        populatedUser.permissions.forEach((permObj) => {
          if (permObj && permObj.permission) {
            allPermissions.add(permObj.permission);
          }
        });
      }

      // Add group-based permissions
      if (populatedUser.group_roles && populatedUser.group_roles.length > 0) {
        console.log(
          `🏢 Enhanced RBAC: Processing ${populatedUser.group_roles.length} group roles`
        );
        const groupPermissions = await this.getGroupPermissions(
          populatedUser.group_roles
        );
        groupPermissions.forEach((permission) =>
          allPermissions.add(permission)
        );
      }

      // Add network-based permissions
      if (
        populatedUser.network_roles &&
        populatedUser.network_roles.length > 0
      ) {
        console.log(
          `🌐 Enhanced RBAC: Processing ${populatedUser.network_roles.length} network roles`
        );
        const networkPermissions = await this.getNetworkPermissions(
          populatedUser.network_roles
        );
        networkPermissions.forEach((permission) =>
          allPermissions.add(permission)
        );
      }

      const isSuperAdmin = this.isSuperAdmin(populatedUser);

      const finalPermissions = Array.from(allPermissions);
      console.log("🎯 Enhanced RBAC: FINAL PERMISSIONS:", {
        totalPermissions: finalPermissions.length,
        isSuperAdmin,
        samplePermissions: finalPermissions.slice(0, 10),
      });

      // Cache the result
      this.rolePermissionCache.set(cacheKey, finalPermissions);
      this.cacheExpiry.set(cacheKey, now + this.CACHE_TTL);

      return finalPermissions;
    } catch (error) {
      console.error("❌ Enhanced RBAC ERROR in getUserPermissions:", error);
      logger.error(`Error getting user permissions: ${error.message}`);
      return this.getDefaultPermissionsByUserType("user");
    }
  }

  async getUserPermissionsByContext(userId) {
    try {
      console.log(
        "🏢 Enhanced RBAC: getUserPermissionsByContext called for:",
        userId
      );

      // Get user without populate first
      const user = await this.getUserModel().findById(userId).lean();

      if (!user) {
        console.log("❌ Enhanced RBAC Context: User not found:", userId);
        return {
          systemPermissions: [],
          groupPermissions: {},
          networkPermissions: {},
          groupMemberships: [],
          networkMemberships: [],
          isSuperAdmin: false,
        };
      }

      // Manually populate the user data
      const populatedUser = await this._populateUserRoleData(user);

      // System-level permissions
      const systemPermissions = new Set();
      const userType = populatedUser.userType || "user"; // Fallback to "user" if undefined
      const defaultPermissions = this.getDefaultPermissionsByUserType(userType);
      defaultPermissions.forEach((permission) =>
        systemPermissions.add(permission)
      );

      // Add direct user permissions to system permissions
      if (populatedUser.permissions && populatedUser.permissions.length > 0) {
        populatedUser.permissions.forEach((permObj) => {
          if (permObj && permObj.permission) {
            systemPermissions.add(permObj.permission);
          }
        });
      }

      const isSuperAdmin = this.isSuperAdmin(populatedUser);
      if (isSuperAdmin) {
        console.log(
          "👑 Enhanced RBAC Context: Super admin - adding all system permissions"
        );
        const allSystemPermissions = await this.getPermissionModel()
          .find({})
          .select("permission")
          .lean();
        const superAdminPermissions = allSystemPermissions.map(
          (p) => p.permission
        );
        superAdminPermissions.forEach((permission) =>
          systemPermissions.add(permission)
        );
      }

      // Group-specific permissions
      const groupPermissions = {};
      const groupMemberships = [];
      // Deactivated groups are tracked separately — they grant no permissions
      // but are included in the context so middleware can return descriptive
      // error messages instead of a generic 403.
      const deactivatedGroupMemberships = [];

      if (populatedUser.group_roles && populatedUser.group_roles.length > 0) {
        for (const groupRole of populatedUser.group_roles) {
          const groupId = groupRole.group?._id || groupRole.group;
          const groupData = groupRole.group?._id ? groupRole.group : null;

          // Skip if groupId is null or undefined
          if (!groupId) {
            console.warn(
              "Skipping group role with null/undefined groupId:",
              groupRole
            );
            continue;
          }

          const groupIdStr = groupId.toString();

          // Option C guard — skip groups that have been explicitly deactivated.
          //
          // Two conditions must both be true before we drop a group:
          //   1. The startup migration has confirmed it has run to completion
          //      (isGroupActivationMigrationComplete() === true). Until then
          //      the guard is fully dormant — pre-existing groups that are
          //      INACTIVE purely from the schema default are not yet filtered,
          //      giving the migration time to activate them first. This makes
          //      single-deployment safe with zero race conditions.
          //   2. We have the group's status from DB-populated data AND it is
          //      not ACTIVE. If groupData is null (group was not populated)
          //      we allow it through rather than silently drop a membership.
          const groupStatus = groupData?.grp_status;
          if (
            isGroupActivationMigrationComplete() &&
            groupStatus &&
            groupStatus !== "ACTIVE"
          ) {
            // Record in deactivatedGroupMemberships so the permission
            // middleware can tell the caller WHY the 403 was issued.
            deactivatedGroupMemberships.push({
              group: {
                id: groupIdStr,
                title: groupData?.grp_title || "Unknown Group",
                status: groupStatus,
                organizationSlug: groupData?.organization_slug || null,
              },
              userType: groupRole.userType || "guest",
            });
            continue;
          }

          if (!groupPermissions[groupIdStr]) {
            groupPermissions[groupIdStr] = [];
          }

          // Add role-based permissions for this group
          if (groupRole.role && groupRole.role.role_permissions) {
            groupRole.role.role_permissions.forEach((permObj) => {
              if (permObj && permObj.permission) {
                groupPermissions[groupIdStr].push(permObj.permission);
              }
            });
          }

          // Add group membership info
          groupMemberships.push({
            group: {
              id: groupIdStr,
              title: groupData?.grp_title || "Unknown Group",
              status: groupData?.grp_status || "unknown",
              organizationSlug: groupData?.organization_slug || null,
            },
            role: groupRole.role
              ? {
                  id: groupRole.role._id ? groupRole.role._id.toString() : null,
                  name: groupRole.role.role_name || "Unknown Role",
                  permissions:
                    groupRole.role.role_permissions?.map((p) => p.permission) ||
                    [],
                }
              : null,
            userType: groupRole.userType || "guest",
            joinedAt: groupRole.createdAt,
            permissions: groupPermissions[groupIdStr],
          });
        }
      }

      // Network-specific permissions
      const networkPermissions = {};
      const networkMemberships = [];
      if (
        populatedUser.network_roles &&
        populatedUser.network_roles.length > 0
      ) {
        for (const networkRole of populatedUser.network_roles) {
          const networkId = networkRole.network?._id || networkRole.network;
          const networkData = networkRole.network?._id
            ? networkRole.network
            : null;

          // Skip if networkId is null or undefined
          if (!networkId) {
            console.warn(
              "Skipping network role with null/undefined networkId:",
              networkRole
            );
            continue;
          }

          const networkIdStr = networkId.toString();

          if (!networkPermissions[networkIdStr]) {
            networkPermissions[networkIdStr] = [];
          }

          // Add role-based permissions for this network
          if (networkRole.role && networkRole.role.role_permissions) {
            networkRole.role.role_permissions.forEach((permObj) => {
              if (permObj && permObj.permission) {
                networkPermissions[networkIdStr].push(permObj.permission);
              }
            });
          }

          // Add network membership info
          networkMemberships.push({
            network: {
              id: networkIdStr,
              name: networkData?.net_name || "Unknown Network",
              status: networkData?.net_status || "unknown",
              acronym: networkData?.net_acronym || null,
            },
            role: networkRole.role
              ? {
                  id: networkRole.role._id
                    ? networkRole.role._id.toString()
                    : null,
                  name: networkRole.role.role_name || "Unknown Role",
                  permissions:
                    networkRole.role.role_permissions?.map(
                      (p) => p.permission
                    ) || [],
                }
              : null,
            userType: networkRole.userType || "guest",
            joinedAt: networkRole.createdAt,
            permissions: networkPermissions[networkIdStr],
          });
        }
      }

      const result = {
        systemPermissions: Array.from(systemPermissions),
        groupPermissions,
        networkPermissions,
        groupMemberships,
        networkMemberships,
        deactivatedGroupMemberships,
        isSuperAdmin,
      };

      console.log("✅ Enhanced RBAC Context result:", {
        systemPermissionsCount: result.systemPermissions.length,
        groupCount: Object.keys(result.groupPermissions).length,
        networkCount: Object.keys(result.networkPermissions).length,
        isSuperAdmin: result.isSuperAdmin,
      });

      return result;
    } catch (error) {
      console.error("❌ Enhanced RBAC Context ERROR:", error);
      logger.error(
        `Error getting user permissions by context: ${error.message}`
      );
      return {
        systemPermissions: [],
        groupPermissions: {},
        networkPermissions: {},
        groupMemberships: [],
        networkMemberships: [],
        deactivatedGroupMemberships: [],
        isSuperAdmin: false,
      };
    }
  }

  async getUserPermissionsForLogin(userId) {
    const redisKey = `airqo:rbac:${this.tenant}:${userId}`;
    const empty = {
      allPermissions: [],
      systemPermissions: [],
      groupPermissions: {},
      networkPermissions: {},
      groupMemberships: [],
      networkMemberships: [],
      isSuperAdmin: false,
    };

    try {
      logger.debug(
        `[rbac] getUserPermissionsForLogin for user ${userId} (tenant: ${this.tenant})`
      );

      // ── L2: Redis cache (shared across replicas) ──────────────────────
      const cached = await _redisGet(redisKey);
      if (cached) {
        logger.debug(`[rbac] Redis cache hit for user ${userId}`);
        return cached;
      }

      // ── DB lookup ─────────────────────────────────────────────────────
      const contextData = await this.getUserPermissionsByContext(userId);

      const allPermissions = [
        ...contextData.systemPermissions,
        ...Object.values(contextData.groupPermissions).flat(),
        ...Object.values(contextData.networkPermissions).flat(),
      ];

      const result = {
        allPermissions: [...new Set(allPermissions)],
        systemPermissions: contextData.systemPermissions,
        groupPermissions: contextData.groupPermissions,
        networkPermissions: contextData.networkPermissions,
        groupMemberships: contextData.groupMemberships,
        networkMemberships: contextData.networkMemberships,
        isSuperAdmin: contextData.isSuperAdmin,
      };

      // ── Populate both caches (fire-and-forget for Redis) ──────────────
      _redisSet(redisKey, result, REDIS_RBAC_TTL).catch(() => {});

      logger.debug(`[rbac] permissions computed for user ${userId}`, {
        allPermissionsCount: result.allPermissions.length,
        isSuperAdmin: result.isSuperAdmin,
      });

      return result;
    } catch (error) {
      logger.error(
        `[rbac] getUserPermissionsForLogin error for user ${userId}: ${error.message}`
      );
      return empty;
    }
  }

  async getGroupPermissions(groupRoles) {
    try {
      if (!groupRoles || groupRoles.length === 0) return [];

      const permissions = [];

      for (const groupRole of groupRoles) {
        if (groupRole.role && groupRole.role.role_permissions) {
          groupRole.role.role_permissions.forEach((permObj) => {
            if (permObj && permObj.permission) {
              permissions.push(permObj.permission);
            }
          });
        }
      }

      return [...new Set(permissions)];
    } catch (error) {
      console.error("Error getting group permissions:", error);
      return [];
    }
  }

  async getNetworkPermissions(networkRoles) {
    try {
      if (!networkRoles || networkRoles.length === 0) return [];

      const permissions = [];

      for (const networkRole of networkRoles) {
        if (networkRole.role && networkRole.role.role_permissions) {
          networkRole.role.role_permissions.forEach((permObj) => {
            if (permObj && permObj.permission) {
              permissions.push(permObj.permission);
            }
          });
        }
      }

      return [...new Set(permissions)];
    } catch (error) {
      console.error("Error getting network permissions:", error);
      return [];
    }
  }

  isSuperAdmin(user) {
    if (!user) return false;

    // Check direct privilege/userType with strict matching
    const priv = String(user.privilege || "")
      .trim()
      .toUpperCase();
    if (priv === "SUPER_ADMIN" || priv.endsWith("_SUPER_ADMIN")) {
      return true;
    }
    const ut = String(user.userType || "")
      .trim()
      .toUpperCase();
    if (ut === "SUPER_ADMIN" || ut.endsWith("_SUPER_ADMIN")) {
      return true;
    }

    // Check group roles for names like 'AIRQO_SUPER_ADMIN'
    if (user.group_roles && user.group_roles.length > 0) {
      const hasSuperAdminGroupRole = user.group_roles.some((gr) => {
        if (gr && gr.role && typeof gr.role.role_name === "string") {
          const rn = gr.role.role_name.trim().toUpperCase();
          if (rn === "SUPER_ADMIN" || rn.endsWith("_SUPER_ADMIN")) {
            return true;
          }
        }
        return false;
      });
      if (hasSuperAdminGroupRole) {
        return true;
      }
    }

    // Check network roles for names like 'NETWORK_SUPER_ADMIN'
    if (user.network_roles && user.network_roles.length > 0) {
      const hasSuperAdminNetworkRole = user.network_roles.some((nr) => {
        if (nr && nr.role && typeof nr.role.role_name === "string") {
          const rn = nr.role.role_name.trim().toUpperCase();
          if (rn === "SUPER_ADMIN" || rn.endsWith("_SUPER_ADMIN")) {
            return true;
          }
        }
        return false;
      });
      if (hasSuperAdminNetworkRole) {
        return true;
      }
    }

    return false;
  }

  getAllSuperAdminPermissions() {
    return constants.DEFAULTS.SUPER_ADMIN;
  }

  getDefaultPermissionsByUserType(userType) {
    const defaultPermissions = {
      user: [
        constants.DASHBOARD_VIEW,
        constants.PROFILE_VIEW,
        constants.PROFILE_UPDATE,
      ],
      guest: [constants.DASHBOARD_VIEW],
      member: [
        constants.DASHBOARD_VIEW,
        constants.PROFILE_VIEW,
        constants.PROFILE_UPDATE,
        constants.DATA_VIEW,
      ],
      admin: constants.DEFAULTS.DEFAULT_ADMIN
        ? constants.DEFAULTS.DEFAULT_ADMIN
        : this.getAllSuperAdminPermissions(),
      super_admin: this.getAllSuperAdminPermissions(),
      moderator: [
        constants.DASHBOARD_VIEW,
        constants.USER_VIEW,
        constants.GROUP_VIEW,
        constants.NETWORK_VIEW,
        constants.DATA_VIEW,
        constants.REPORT_GENERATE,
      ],
      viewer: [constants.DASHBOARD_VIEW, constants.DATA_VIEW],
      contributor: [
        constants.DASHBOARD_VIEW,
        constants.DATA_VIEW,
        constants.DATA_CREATE,
        constants.DATA_UPDATE,
      ],
    };

    const permissions = defaultPermissions[userType] || defaultPermissions.user;
    console.log(
      `📋 Enhanced RBAC: Default permissions for ${userType}:`,
      permissions.length
    );
    return permissions;
  }

  async hasPermission(
    userId,
    requiredPermissions,
    requireAll = false,
    contextId = null,
    contextType = null
  ) {
    try {
      let userPermissions;

      if (contextId && contextType) {
        // Context-specific permission check
        const contextData = await this.getUserPermissionsByContext(userId);

        if (contextType === "group") {
          userPermissions = contextData.groupPermissions[contextId] || [];
          // Also include system permissions for group context
          userPermissions = [
            ...userPermissions,
            ...contextData.systemPermissions,
          ];
        } else if (contextType === "network") {
          userPermissions = contextData.networkPermissions[contextId] || [];
          // Also include system permissions for network context
          userPermissions = [
            ...userPermissions,
            ...contextData.systemPermissions,
          ];
        } else {
          userPermissions = await this.getUserPermissions(userId);
        }
      } else {
        // Global permission check
        userPermissions = await this.getUserPermissions(userId);
      }

      const toKey = (p) =>
        (typeof p === "string" ? p : String(p))
          .replace(/:/g, "_")
          .toUpperCase();
      const needed = (
        Array.isArray(requiredPermissions)
          ? requiredPermissions
          : [requiredPermissions]
      ).map(toKey);
      const userSet = new Set((userPermissions || []).map(toKey));
      return requireAll
        ? needed.every((p) => userSet.has(p))
        : needed.some((p) => userSet.has(p));
    } catch (error) {
      logger.error(`Error checking user permission: ${error.message}`);
      return false;
    }
  }

  /**
   * Populate direct user permissions
   */
  async _populateDirectPermissions(user) {
    if (!user.permissions || user.permissions.length === 0) return [];

    try {
      return await this.getPermissionModel()
        .find({ _id: { $in: user.permissions } })
        .select("permission description")
        .lean();
    } catch (error) {
      console.warn("Could not populate direct permissions:", error.message);
      return [];
    }
  }

  /**
   * Batch populate role permissions for multiple roles
   */
  async _batchPopulateRolePermissions(roleIds) {
    if (!roleIds || roleIds.length === 0) return new Map();

    try {
      // Remove duplicates and filter out nulls/undefined
      const uniqueRoleIds = [...new Set(roleIds.filter(Boolean))];

      if (uniqueRoleIds.length === 0) return new Map();

      // Batch fetch all roles
      const roles = await this.getRoleModel()
        .find({ _id: { $in: uniqueRoleIds } })
        .lean();

      // Collect all permission IDs from all roles
      const allPermissionIds = roles.flatMap(
        (role) => role.role_permissions || []
      );
      const uniquePermissionIds = [
        ...new Set(allPermissionIds.filter(Boolean)),
      ];

      // Batch fetch all permissions
      const permissions =
        uniquePermissionIds.length > 0
          ? await this.getPermissionModel()
              .find({ _id: { $in: uniquePermissionIds } })
              .select("permission description")
              .lean()
          : [];

      // Create permission lookup map
      const permissionsMap = new Map(
        permissions.map((p) => [p._id.toString(), p])
      );

      // Create roles map with populated permissions
      const rolesMap = new Map();
      roles.forEach((role) => {
        const populatedRole = { ...role };
        if (role.role_permissions && role.role_permissions.length > 0) {
          populatedRole.role_permissions = role.role_permissions
            .map((permId) => permissionsMap.get(permId.toString()))
            .filter(Boolean);
        }
        rolesMap.set(role._id.toString(), populatedRole);
      });

      return rolesMap;
    } catch (error) {
      console.warn("Could not batch populate role permissions:", error.message);
      return new Map();
    }
  }

  /**
   * Batch populate group data
   */
  async _batchPopulateGroups(groupIds) {
    if (!groupIds || groupIds.length === 0) return new Map();

    try {
      const uniqueGroupIds = [...new Set(groupIds.filter(Boolean))];

      if (uniqueGroupIds.length === 0) return new Map();

      const groups = await this.getGroupModel()
        .find({ _id: { $in: uniqueGroupIds } })
        .select("grp_title grp_status organization_slug")
        .lean();

      return new Map(groups.map((g) => [g._id.toString(), g]));
    } catch (error) {
      console.warn("Could not batch populate groups:", error.message);
      return new Map();
    }
  }

  /**
   * Batch populate network data
   */
  async _batchPopulateNetworks(networkIds) {
    if (!networkIds || networkIds.length === 0) return new Map();

    try {
      const uniqueNetworkIds = [...new Set(networkIds.filter(Boolean))];

      if (uniqueNetworkIds.length === 0) return new Map();

      const networks = await this.getNetworkModel()
        .find({ _id: { $in: uniqueNetworkIds } })
        .select("net_name net_status net_acronym")
        .lean();

      return new Map(networks.map((n) => [n._id.toString(), n]));
    } catch (error) {
      console.warn("Could not batch populate networks:", error.message);
      return new Map();
    }
  }

  /**
   * Populate group roles with optimized batch fetching
   */
  async _populateGroupRoles(groupRoles) {
    if (!groupRoles || groupRoles.length === 0) return [];

    try {
      // Extract all role and group IDs
      const roleIds = groupRoles.map((gr) => gr.role).filter(Boolean);
      const groupIds = groupRoles.map((gr) => gr.group).filter(Boolean);

      // Batch fetch all required data in parallel
      const [rolesMap, groupsMap] = await Promise.all([
        this._batchPopulateRolePermissions(roleIds),
        this._batchPopulateGroups(groupIds),
      ]);

      // Map the data back to group roles
      return groupRoles.map((groupRole) => {
        const populatedGroupRole = { ...groupRole };

        // Populate role data
        if (groupRole.role) {
          const roleId = groupRole.role.toString();
          populatedGroupRole.role = rolesMap.get(roleId) || null;
        }

        // Populate group data
        if (groupRole.group) {
          const groupId = groupRole.group.toString();
          populatedGroupRole.group = groupsMap.get(groupId) || {
            _id: groupRole.group,
          };
        }

        return populatedGroupRole;
      });
    } catch (error) {
      console.warn("Could not populate group roles:", error.message);
      return groupRoles;
    }
  }

  /**
   * Populate network roles with optimized batch fetching
   */
  async _populateNetworkRoles(networkRoles) {
    if (!networkRoles || networkRoles.length === 0) return [];

    try {
      // Extract all role and network IDs
      const roleIds = networkRoles.map((nr) => nr.role).filter(Boolean);
      const networkIds = networkRoles.map((nr) => nr.network).filter(Boolean);

      // Batch fetch all required data in parallel
      const [rolesMap, networksMap] = await Promise.all([
        this._batchPopulateRolePermissions(roleIds),
        this._batchPopulateNetworks(networkIds),
      ]);

      // Map the data back to network roles
      return networkRoles.map((networkRole) => {
        const populatedNetworkRole = { ...networkRole };

        // Populate role data
        if (networkRole.role) {
          const roleId = networkRole.role.toString();
          populatedNetworkRole.role = rolesMap.get(roleId) || null;
        }

        // Populate network data
        if (networkRole.network) {
          const networkId = networkRole.network.toString();
          populatedNetworkRole.network = networksMap.get(networkId) || {
            _id: networkRole.network,
          };
        }

        return populatedNetworkRole;
      });
    } catch (error) {
      console.warn("Could not populate network roles:", error.message);
      return networkRoles;
    }
  }

  async hasRole(userId, requiredRoles, contextId = null, contextType = null) {
    try {
      const user = await this.getUserModel().findById(userId).lean();
      if (!user) return false;
      const populatedUser = await this._populateUserRoleData(user);
      const userRoles = [];

      // Add user type as a role
      userRoles.push(populatedUser.userType);
      userRoles.push(populatedUser.privilege);

      if (contextId && contextType) {
        // Context-specific role check
        if (contextType === "group" && user.group_roles) {
          const groupRole = user.group_roles.find(
            (gr) =>
              (gr.group._id || gr.group).toString() === contextId.toString()
          );
          if (groupRole) {
            userRoles.push(groupRole.userType);
            if (groupRole.role && groupRole.role.role_name) {
              userRoles.push(groupRole.role.role_name);
            }
          }
        } else if (contextType === "network" && user.network_roles) {
          const networkRole = user.network_roles.find(
            (nr) =>
              (nr.network._id || nr.network).toString() === contextId.toString()
          );
          if (networkRole) {
            userRoles.push(networkRole.userType);
            if (networkRole.role && networkRole.role.role_name) {
              userRoles.push(networkRole.role.role_name);
            }
          }
        }
      } else {
        // Global role check - include all roles
        if (populatedUser.group_roles) {
          populatedUser.group_roles.forEach((gr) => {
            userRoles.push(gr.userType);
            if (gr.role && gr.role.role_name) {
              userRoles.push(gr.role.role_name);
            }
          });
        }

        if (populatedUser.network_roles) {
          populatedUser.network_roles.forEach((nr) => {
            userRoles.push(nr.userType);
            if (nr.role && nr.role.role_name) {
              userRoles.push(nr.role.role_name);
            }
          });
        }
      }

      const roles = Array.isArray(requiredRoles)
        ? requiredRoles
        : [requiredRoles];

      return roles.some((role) => {
        const normalizedRole = String(role).trim().toUpperCase();
        return userRoles.some((userRole) => {
          if (!userRole) return false;
          const normalizedUserRole = String(userRole).trim().toUpperCase();
          return (
            normalizedUserRole === normalizedRole ||
            normalizedUserRole.endsWith(`_${normalizedRole}`)
          );
        });
      });
    } catch (error) {
      logger.error(`Error checking user role: ${error.message}`);
      return false;
    }
  }

  async isSuperAdminInContext(userId, contextId, contextType) {
    try {
      // A super admin in a specific context would have a role named like 'ORG_SUPER_ADMIN'
      const userRoles = await this.getUserRolesInContext(
        userId,
        contextId,
        contextType
      );
      if (!userRoles || userRoles.length === 0) {
        return false;
      }
      // Check if any of the user's roles for this context end with _SUPER_ADMIN
      return userRoles.some(
        (roleName) =>
          roleName && roleName.toUpperCase().endsWith("_SUPER_ADMIN")
      );
    } catch (error) {
      logger.error(
        `Error checking super admin status in context: ${error.message}`
      );
      return false;
    }
  }

  async isSystemSuperAdmin(userId) {
    try {
      const user = await this.getUserModel().findById(userId).lean();
      if (!user) return false;

      // Manually populate user data to avoid schema issues
      const populatedUser = await this._populateUserRoleData(user);

      // Check 1: User has AIRQO_SUPER_ADMIN role or admin user type in AirQo group
      const hasAirqoAdminRole = populatedUser.group_roles?.some((gr) => {
        const groupId = gr.group?._id || gr.group;

        // Skip if groupId is null/undefined
        if (!groupId) return false;

        const isAirqoGroup = constants.HELPERS.isSystemAdminGroup(
          groupId.toString()
        );
        const isAdminUserType = constants.HELPERS.isSystemAdminUserType(
          gr.userType
        );

        // Check if the role name indicates system admin
        const hasSystemAdminRole =
          gr.role &&
          gr.role.role_name &&
          constants.HELPERS.isSystemAdminRole(gr.role.role_name);

        return isAirqoGroup && (isAdminUserType || hasSystemAdminRole);
      });

      if (hasAirqoAdminRole) {
        return true;
      }

      // Check 2: Direct system admin permissions on user
      if (populatedUser.permissions && populatedUser.permissions.length > 0) {
        const hasSystemPermission = populatedUser.permissions.some(
          (permObj) => {
            const permission = permObj.permission || permObj;
            return constants.HELPERS.isSystemAdminPermission(permission);
          }
        );

        if (hasSystemPermission) {
          return true;
        }
      }

      // Check 3: System admin role names in any group/network roles
      const allRoles = [
        ...(populatedUser.group_roles?.map((gr) => gr.role).filter(Boolean) ||
          []),
        ...(populatedUser.network_roles?.map((nr) => nr.role).filter(Boolean) ||
          []),
      ];

      for (const role of allRoles) {
        if (role && role.role_name) {
          if (constants.HELPERS.isSystemAdminRole(role.role_name)) {
            return true;
          }
        }
        if (role && role.role_code) {
          if (constants.SYSTEM_ADMIN_ROLE_CODES.includes(role.role_code)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error("Error in isSystemSuperAdmin:", error);
      logger.error(`Error checking system super admin: ${error.message}`);
      return false;
    }
  }

  async isGroupMember(userId, groupId) {
    try {
      const user = await this.getUserModel().findById(userId).lean();
      if (!user || !user.group_roles) return false;

      return user.group_roles.some(
        (gr) => (gr.group._id || gr.group).toString() === groupId.toString()
      );
    } catch (error) {
      logger.error(`Error checking group membership: ${error.message}`);
      return false;
    }
  }

  async isNetworkMember(userId, networkId) {
    try {
      const user = await this.getUserModel().findById(userId).lean();
      if (!user || !user.network_roles) return false;

      return user.network_roles.some(
        (nr) =>
          (nr.network._id || nr.network).toString() === networkId.toString()
      );
    } catch (error) {
      logger.error(`Error checking network membership: ${error.message}`);
      return false;
    }
  }

  async isGroupManager(userId, groupId) {
    try {
      const group = await this.getGroupModel().findById(groupId).lean();
      if (!group) return false;

      return (
        group.grp_manager && group.grp_manager.toString() === userId.toString()
      );
    } catch (error) {
      logger.error(`Error checking group manager status: ${error.message}`);
      return false;
    }
  }

  async isNetworkManager(userId, networkId) {
    try {
      const network = await this.getNetworkModel().findById(networkId).lean();
      if (!network) return false;

      return (
        network.net_manager &&
        network.net_manager.toString() === userId.toString()
      );
    } catch (error) {
      logger.error(`Error checking network manager status: ${error.message}`);
      return false;
    }
  }

  async getUserPermissionsInContext(userId, contextId, contextType) {
    try {
      const contextData = await this.getUserPermissionsByContext(userId);

      if (contextType === "group") {
        return [
          ...contextData.systemPermissions,
          ...(contextData.groupPermissions[contextId] || []),
        ];
      } else if (contextType === "network") {
        return [
          ...contextData.systemPermissions,
          ...(contextData.networkPermissions[contextId] || []),
        ];
      }

      return contextData.systemPermissions;
    } catch (error) {
      logger.error(
        `Error getting user permissions in context: ${error.message}`
      );
      return [];
    }
  }

  async getUserRolesInContext(userId, contextId, contextType) {
    try {
      const contextData = await this.getUserPermissionsByContext(userId);
      let roles = [];

      if (contextType === "group") {
        const membership = contextData.groupMemberships.find(
          (m) => m.group.id === contextId.toString()
        );
        if (membership && membership.role) {
          roles.push(membership.role.name);
        }
      } else if (contextType === "network") {
        const membership = contextData.networkMemberships.find(
          (m) => m.network.id === contextId.toString()
        );
        if (membership && membership.role) {
          roles.push(membership.role.name);
        }
      }
      return roles;
    } catch (error) {
      logger.error(`Error getting user roles in context: ${error.message}`);
      return [];
    }
  }

  // Cache management methods
  clearCache() {
    this.rolePermissionCache.clear();
    this.cacheExpiry.clear();
    logger.info("Enhanced RBAC permission cache cleared");
  }

  clearUserCache(userId) {
    if (!userId) return;

    const userIdStr = userId.toString();
    for (const [key] of this.rolePermissionCache) {
      if (key === userIdStr || key.includes(userIdStr)) {
        this.rolePermissionCache.delete(key);
        this.cacheExpiry.delete(key);
      }
    }
    logger.info(`Enhanced RBAC cache cleared for user: ${userIdStr}`);
  }

  cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, expiry] of this.cacheExpiry) {
      if (expiry && expiry < now) {
        this.rolePermissionCache.delete(key);
        this.cacheExpiry.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned ${cleanedCount} expired cache entries`);
    }
  }

  async debugUserPermissions(userId) {
    try {
      const contextData = await this.getUserPermissionsByContext(userId);

      return {
        userId,
        systemPermissions: contextData.systemPermissions,
        groupPermissions: contextData.groupPermissions,
        networkPermissions: contextData.networkPermissions,
        groupMemberships: contextData.groupMemberships,
        networkMemberships: contextData.networkMemberships,
        isSuperAdmin: contextData.isSuperAdmin,
        allPermissions: [
          ...contextData.systemPermissions,
          ...Object.values(contextData.groupPermissions).flat(),
          ...Object.values(contextData.networkPermissions).flat(),
        ],
      };
    } catch (error) {
      logger.error(`Error debugging user permissions: ${error.message}`);
      return { error: error.message };
    }
  }
}

module.exports = RBACService;
module.exports.invalidateUserRBACCache = invalidateUserRBACCache;
