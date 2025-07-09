// services/enhancedRBAC.service.js
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- enhanced-rbac-service`
);

class EnhancedRBACService {
  constructor(tenant = "airqo") {
    this.tenant = tenant;
    this.rolePermissionCache = new Map();
    this.cacheExpiry = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes

    // Set up periodic cache cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanExpiredCache();
    }, 5 * 60 * 1000);
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

      const user = await this.getUserModel()
        .findById(userId)
        .populate({
          path: "permissions",
          select: "permission description",
        })
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
        console.log("❌ Enhanced RBAC: User not found:", userId);
        return [];
      }

      const allPermissions = new Set();

      // Add default permissions based on user type
      const defaultPermissions = this.getDefaultPermissionsByUserType(
        user.userType
      );
      defaultPermissions.forEach((permission) =>
        allPermissions.add(permission)
      );

      // Check if super admin
      const isSuperAdmin = this.isSuperAdmin(user);
      if (isSuperAdmin) {
        console.log(
          "👑 Enhanced RBAC: User is super admin - adding ALL permissions"
        );
        const superAdminPermissions = this.getAllSuperAdminPermissions();
        superAdminPermissions.forEach((permission) =>
          allPermissions.add(permission)
        );
      } else {
        // Add direct user permissions
        if (user.permissions && user.permissions.length > 0) {
          console.log(
            `📋 Enhanced RBAC: Processing ${user.permissions.length} direct permissions`
          );
          user.permissions.forEach((permObj) => {
            if (permObj && permObj.permission) {
              allPermissions.add(permObj.permission);
            }
          });
        }

        // Add group-based permissions
        if (user.group_roles && user.group_roles.length > 0) {
          console.log(
            `🏢 Enhanced RBAC: Processing ${user.group_roles.length} group roles`
          );
          const groupPermissions = await this.getGroupPermissions(
            user.group_roles
          );
          groupPermissions.forEach((permission) =>
            allPermissions.add(permission)
          );
        }

        // Add network-based permissions
        if (user.network_roles && user.network_roles.length > 0) {
          console.log(
            `🌐 Enhanced RBAC: Processing ${user.network_roles.length} network roles`
          );
          const networkPermissions = await this.getNetworkPermissions(
            user.network_roles
          );
          networkPermissions.forEach((permission) =>
            allPermissions.add(permission)
          );
        }
      }

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

      const user = await this.getUserModel()
        .findById(userId)
        .populate({
          path: "permissions",
          select: "permission description",
        })
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
        .populate({
          path: "group_roles.group",
          select: "grp_title grp_status organization_slug",
        })
        .populate({
          path: "network_roles.network",
          select: "net_name net_status net_acronym",
        })
        .lean();

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

      // System-level permissions
      const systemPermissions = new Set();
      const defaultPermissions = this.getDefaultPermissionsByUserType(
        user.userType
      );
      defaultPermissions.forEach((permission) =>
        systemPermissions.add(permission)
      );

      // Add direct user permissions to system permissions
      if (user.permissions && user.permissions.length > 0) {
        user.permissions.forEach((permObj) => {
          if (permObj && permObj.permission) {
            systemPermissions.add(permObj.permission);
          }
        });
      }

      const isSuperAdmin = this.isSuperAdmin(user);
      if (isSuperAdmin) {
        console.log(
          "👑 Enhanced RBAC Context: Super admin - adding all system permissions"
        );
        const superAdminPermissions = this.getAllSuperAdminPermissions();
        superAdminPermissions.forEach((permission) =>
          systemPermissions.add(permission)
        );
      }

      // Group-specific permissions
      const groupPermissions = {};
      const groupMemberships = [];
      if (user.group_roles && user.group_roles.length > 0) {
        for (const groupRole of user.group_roles) {
          const groupId = groupRole.group._id || groupRole.group;
          const groupData = groupRole.group._id ? groupRole.group : null;

          if (!groupPermissions[groupId]) {
            groupPermissions[groupId] = [];
          }

          // Add role-based permissions for this group
          if (groupRole.role && groupRole.role.role_permissions) {
            groupRole.role.role_permissions.forEach((permObj) => {
              if (permObj && permObj.permission) {
                groupPermissions[groupId].push(permObj.permission);
              }
            });
          }

          // Add group membership info
          groupMemberships.push({
            group: {
              id: groupId.toString(),
              title: groupData?.grp_title || "Unknown Group",
              status: groupData?.grp_status || "unknown",
              organizationSlug: groupData?.organization_slug || null,
            },
            role: groupRole.role
              ? {
                  id: groupRole.role._id,
                  name: groupRole.role.role_name,
                  permissions:
                    groupRole.role.role_permissions?.map((p) => p.permission) ||
                    [],
                }
              : null,
            userType: groupRole.userType || "guest",
            joinedAt: groupRole.createdAt,
            permissions: groupPermissions[groupId],
          });
        }
      }

      // Network-specific permissions
      const networkPermissions = {};
      const networkMemberships = [];
      if (user.network_roles && user.network_roles.length > 0) {
        for (const networkRole of user.network_roles) {
          const networkId = networkRole.network._id || networkRole.network;
          const networkData = networkRole.network._id
            ? networkRole.network
            : null;

          if (!networkPermissions[networkId]) {
            networkPermissions[networkId] = [];
          }

          // Add role-based permissions for this network
          if (networkRole.role && networkRole.role.role_permissions) {
            networkRole.role.role_permissions.forEach((permObj) => {
              if (permObj && permObj.permission) {
                networkPermissions[networkId].push(permObj.permission);
              }
            });
          }

          // Add network membership info
          networkMemberships.push({
            network: {
              id: networkId.toString(),
              name: networkData?.net_name || "Unknown Network",
              status: networkData?.net_status || "unknown",
              acronym: networkData?.net_acronym || null,
            },
            role: networkRole.role
              ? {
                  id: networkRole.role._id,
                  name: networkRole.role.role_name,
                  permissions:
                    networkRole.role.role_permissions?.map(
                      (p) => p.permission
                    ) || [],
                }
              : null,
            userType: networkRole.userType || "guest",
            joinedAt: networkRole.createdAt,
            permissions: networkPermissions[networkId],
          });
        }
      }

      const result = {
        systemPermissions: Array.from(systemPermissions),
        groupPermissions,
        networkPermissions,
        groupMemberships,
        networkMemberships,
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
        isSuperAdmin: false,
      };
    }
  }

  async getUserPermissionsForLogin(userId) {
    try {
      console.log(
        "🔐 Enhanced RBAC: getUserPermissionsForLogin called for:",
        userId
      );

      const contextData = await this.getUserPermissionsByContext(userId);

      const allPermissions = [
        ...contextData.systemPermissions,
        ...Object.values(contextData.groupPermissions).flat(),
        ...Object.values(contextData.networkPermissions).flat(),
      ];

      const uniqueAllPermissions = [...new Set(allPermissions)];

      const result = {
        allPermissions: uniqueAllPermissions,
        systemPermissions: contextData.systemPermissions,
        groupPermissions: contextData.groupPermissions,
        networkPermissions: contextData.networkPermissions,
        groupMemberships: contextData.groupMemberships,
        networkMemberships: contextData.networkMemberships,
        isSuperAdmin: contextData.isSuperAdmin,
      };

      console.log("✅ Enhanced RBAC Login permissions result:", {
        allPermissionsCount: result.allPermissions.length,
        systemPermissionsCount: result.systemPermissions.length,
        isSuperAdmin: result.isSuperAdmin,
      });

      return result;
    } catch (error) {
      console.error("❌ Enhanced RBAC Login ERROR:", error);
      logger.error(
        `Error getting user permissions for login: ${error.message}`
      );
      return {
        allPermissions: [],
        systemPermissions: [],
        groupPermissions: {},
        networkPermissions: {},
        groupMemberships: [],
        networkMemberships: [],
        isSuperAdmin: false,
      };
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

    console.log("🔍 Enhanced RBAC: Checking super admin status:", {
      privilege: user.privilege,
      userType: user.userType,
      organization: user.organization,
    });

    // Check various super admin indicators
    if (user.privilege === "super_admin" || user.privilege === "super-admin") {
      console.log("✅ Enhanced RBAC: Super admin via privilege");
      return true;
    }

    if (user.userType === "admin" || user.userType === "super_admin") {
      console.log("✅ Enhanced RBAC: Super admin via userType");
      return true;
    }

    // Check if user has super admin role in groups or networks
    if (user.group_roles && user.group_roles.length > 0) {
      const hasSuperAdminGroupRole = user.group_roles.some(
        (gr) =>
          gr.userType === "super_admin" ||
          (gr.role &&
            gr.role.role_name &&
            gr.role.role_name.toLowerCase().includes("super"))
      );
      if (hasSuperAdminGroupRole) {
        console.log("✅ Enhanced RBAC: Super admin via group role");
        return true;
      }
    }

    if (user.network_roles && user.network_roles.length > 0) {
      const hasSuperAdminNetworkRole = user.network_roles.some(
        (nr) =>
          nr.userType === "super_admin" ||
          (nr.role &&
            nr.role.role_name &&
            nr.role.role_name.toLowerCase().includes("super"))
      );
      if (hasSuperAdminNetworkRole) {
        console.log("✅ Enhanced RBAC: Super admin via network role");
        return true;
      }
    }

    return false;
  }

  getAllSuperAdminPermissions() {
    return [
      // User Management
      "USER_CREATE",
      "USER_VIEW",
      "USER_UPDATE",
      "USER_DELETE",
      "USER_MANAGE",

      // Group Management
      "GROUP_CREATE",
      "GROUP_VIEW",
      "GROUP_UPDATE",
      "GROUP_DELETE",
      "GROUP_MANAGE",
      "GROUP_MEMBER_MANAGE",

      // Network Management
      "NETWORK_CREATE",
      "NETWORK_VIEW",
      "NETWORK_UPDATE",
      "NETWORK_DELETE",
      "NETWORK_MANAGE",
      "NETWORK_MEMBER_MANAGE",

      // Role & Permission Management
      "ROLE_CREATE",
      "ROLE_VIEW",
      "ROLE_UPDATE",
      "ROLE_DELETE",
      "ROLE_MANAGE",
      "PERMISSION_CREATE",
      "PERMISSION_VIEW",
      "PERMISSION_UPDATE",
      "PERMISSION_DELETE",
      "PERMISSION_MANAGE",

      // System Management
      "SYSTEM_CONFIGURE",
      "SYSTEM_MONITOR",
      "DASHBOARD_VIEW",
      "ANALYTICS_VIEW",
      "REPORTS_GENERATE",
      "LOGS_VIEW",

      // Data Management
      "DATA_EXPORT",
      "DATA_IMPORT",
      "DATA_DELETE",
      "DATA_BACKUP",
      "DATA_RESTORE",

      // Device Management (if applicable)
      "DEVICE_CREATE",
      "DEVICE_VIEW",
      "DEVICE_UPDATE",
      "DEVICE_DELETE",
      "DEVICE_MANAGE",
      "DEVICE_MONITOR",

      // Site Management (if applicable)
      "SITE_CREATE",
      "SITE_VIEW",
      "SITE_UPDATE",
      "SITE_DELETE",
      "SITE_MANAGE",

      // Advanced Operations
      "ADMIN_FULL_ACCESS",
      "SUPER_ADMIN_ACTIONS",
    ];
  }

  getDefaultPermissionsByUserType(userType) {
    const defaultPermissions = {
      user: ["DASHBOARD_VIEW", "PROFILE_VIEW", "PROFILE_UPDATE"],
      guest: ["DASHBOARD_VIEW"],
      member: ["DASHBOARD_VIEW", "PROFILE_VIEW", "PROFILE_UPDATE", "DATA_VIEW"],
      admin: this.getAllSuperAdminPermissions(),
      super_admin: this.getAllSuperAdminPermissions(),
      moderator: [
        "DASHBOARD_VIEW",
        "USER_VIEW",
        "GROUP_VIEW",
        "NETWORK_VIEW",
        "DATA_VIEW",
        "REPORTS_VIEW",
      ],
      viewer: ["DASHBOARD_VIEW", "DATA_VIEW"],
      contributor: [
        "DASHBOARD_VIEW",
        "DATA_VIEW",
        "DATA_CREATE",
        "DATA_UPDATE",
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

      const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      if (requireAll) {
        return permissions.every((permission) =>
          userPermissions.includes(permission)
        );
      } else {
        return permissions.some((permission) =>
          userPermissions.includes(permission)
        );
      }
    } catch (error) {
      logger.error(`Error checking user permission: ${error.message}`);
      return false;
    }
  }

  async hasRole(userId, requiredRoles, contextId = null, contextType = null) {
    try {
      const user = await this.getUserModel().findById(userId).lean();
      if (!user) return false;

      const userRoles = [];

      // Add user type as a role
      userRoles.push(user.userType);
      userRoles.push(user.privilege);

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
        if (user.group_roles) {
          user.group_roles.forEach((gr) => {
            userRoles.push(gr.userType);
            if (gr.role && gr.role.role_name) {
              userRoles.push(gr.role.role_name);
            }
          });
        }

        if (user.network_roles) {
          user.network_roles.forEach((nr) => {
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
        const normalizedRole = role.toUpperCase();
        return userRoles.some((userRole) => {
          if (!userRole) return false;
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

module.exports = EnhancedRBACService;
