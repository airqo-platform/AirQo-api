// services/rbac.service.js
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- rbac-service`
);

class RBACService {
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
      console.log(
        "🔍 Enhanced RBAC: Checking group roles for super admin:",
        user.group_roles.length
      );
      const hasSuperAdminGroupRole = user.group_roles.some((gr, index) => {
        if (!gr) {
          console.log(
            `⚠️ Enhanced RBAC: Group role ${index} is null/undefined`
          );
          return false;
        }

        console.log(`🔍 Enhanced RBAC: Group role ${index}:`, {
          userType: gr.userType,
          role_name: gr.role?.role_name,
          role_id: gr.role?._id,
        });

        // Check userType
        if (gr.userType === "super_admin") {
          console.log("✅ Enhanced RBAC: Super admin via group userType");
          return true;
        }

        // Check role name
        if (
          gr.role &&
          gr.role.role_name &&
          typeof gr.role.role_name === "string" &&
          gr.role.role_name.toLowerCase().includes("super")
        ) {
          console.log(
            "✅ Enhanced RBAC: Super admin via group role name:",
            gr.role.role_name
          );
          return true;
        }

        return false;
      });
      if (hasSuperAdminGroupRole) {
        console.log("✅ Enhanced RBAC: Super admin via group role");
        return true;
      }
    }

    if (user.network_roles && user.network_roles.length > 0) {
      const hasSuperAdminNetworkRole = user.network_roles.some((nr) => {
        if (!nr) return false;

        // Check userType
        if (nr.userType === "super_admin") return true;

        // Check role name
        if (
          nr.role &&
          nr.role.role_name &&
          typeof nr.role.role_name === "string" &&
          nr.role.role_name.toLowerCase().includes("super")
        ) {
          return true;
        }

        return false;
      });
      if (hasSuperAdminNetworkRole) {
        console.log("✅ Enhanced RBAC: Super admin via network role");
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
      admin: this.getAllSuperAdminPermissions(),
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

  async isSuperAdminInContext(userId, contextId, contextType) {
    try {
      // A super admin in a specific context would have a role named like 'ORG_SUPER_ADMIN'
      // or a role that has the 'SUPER_ADMIN' permission.
      // Let's check for a role named 'SUPER_ADMIN' within the context.
      return await this.hasRole(
        userId,
        ["SUPER_ADMIN"],
        contextId,
        contextType
      );
    } catch (error) {
      logger.error(
        `Error checking super admin status in context: ${error.message}`
      );
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

module.exports = RBACService;
