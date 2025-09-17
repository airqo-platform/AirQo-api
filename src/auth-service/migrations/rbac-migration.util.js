// utils/rbac-migration.util.js
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const GroupModel = require("@models/Group");
const NetworkModel = require("@models/Network");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- rbac-migration`
);
const { logObject } = require("@utils/shared");

class RBACMigrationUtility {
  normalizeName(name) {
    if (!name || typeof name !== "string") {
      return "";
    }
    return name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_\s-]/g, "") // Keep underscores, spaces, hyphens
      .replace(/[\s-]+/g, "_") // Replace spaces and hyphens with a single underscore
      .replace(/_+/g, "_"); // Collapse multiple underscores into one
  }

  constructor(tenant = "airqo") {
    this.tenant = tenant;
    this.results = {
      permissions: { created: 0, skipped: 0, errors: [] },
      roles: { created: 0, updated: 0, skipped: 0, errors: [] },
      users: { updated: 0, skipped: 0, errors: [] },
      groups: { processed: 0, errors: [] },
    };
  }

  /**
   * Run complete RBAC migration
   * @param {Object} options - Migration options
   * @returns {Promise<Object>} Migration results
   */
  async runMigration(options = {}) {
    const {
      createDefaultPermissions = true,
      createDefaultRoles = true,
      updateUserRoles = true,
      validateData = true,
      dryRun = false,
    } = options;

    logger.info(`Starting RBAC migration for tenant: ${this.tenant}`);
    logger.info(`Dry run mode: ${dryRun}`);

    try {
      if (createDefaultPermissions) {
        await this.createDefaultPermissions(dryRun);
      }

      if (createDefaultRoles) {
        await this.createDefaultRoles(dryRun);
      }

      if (updateUserRoles) {
        await this.migrateUserRoles(dryRun);
      }

      if (validateData) {
        await this.validateMigration();
      }

      logger.info("RBAC migration completed successfully");
      return {
        success: true,
        results: this.results,
        summary: this.generateSummary(),
      };
    } catch (error) {
      logger.error(`RBAC migration failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
        results: this.results,
      };
    }
  }

  /**
   * Create default permissions for the system
   * @param {boolean} dryRun - Whether to actually create permissions
   */
  async createDefaultPermissions(dryRun = false) {
    logger.info("Creating default permissions from single source of truth...");
    const PERMISSION_DEFINITIONS = constants.PERMISSION_DEFINITIONS || [];

    for (const permissionDef of PERMISSION_DEFINITIONS) {
      try {
        const permissionData = {
          permission: permissionDef.name,
          description: permissionDef.description,
        };

        const existingPermission = await PermissionModel(this.tenant)
          .findOne({ permission: permissionData.permission })
          .lean();

        if (existingPermission) {
          this.results.permissions.skipped++;
          continue;
        }

        if (!dryRun) {
          await PermissionModel(this.tenant).create(permissionData);
        }

        this.results.permissions.created++;
        logger.debug(`Created permission: ${permissionData.permission}`);
      } catch (error) {
        this.results.permissions.errors.push({
          permission: permissionData.permission,
          error: error.message,
        });
        logger.error(
          `Error creating permission ${permissionData.permission}: ${error.message}`
        );
      }
    }

    logger.info(
      `Permissions created: ${this.results.permissions.created}, skipped: ${this.results.permissions.skipped}`
    );
  }

  /**
   * Create default roles for each group
   * @param {boolean} dryRun - Whether to actually create roles
   */
  async createDefaultRoles(dryRun = false) {
    logger.info(
      "Creating default roles for all organizations (groups and networks)..."
    );

    const groups = await GroupModel(this.tenant).find({}).lean();

    for (const group of groups) {
      try {
        await this.createGroupDefaultRoles(group, dryRun);
        this.results.groups.processed++;
      } catch (error) {
        this.results.groups.errors.push({
          groupId: group._id,
          groupTitle: group.grp_title,
          error: error.message,
        });
        logger.error(
          `Error creating roles for group ${group.grp_title}: ${error.message}`
        );
      }
    }

    const networks = await NetworkModel(this.tenant).find({}).lean();
    for (const network of networks) {
      try {
        await this.createNetworkDefaultRoles(network, dryRun);
        this.results.groups.processed++; // Using 'groups' for general org count
      } catch (error) {
        this.results.groups.errors.push({
          networkId: network._id,
          networkName: network.net_name,
          error: error.message,
        });
        logger.error(
          `Error creating roles for network ${network.net_name}: ${error.message}`
        );
      }
    }
  }

  async _createOrganizationDefaultRoles(organization, orgType, dryRun = false) {
    const PERMISSION_DEFINITIONS = constants.PERMISSION_DEFINITIONS || [];
    const allPermissionNames = PERMISSION_DEFINITIONS.map((p) => p.name);
    const devicePerms = allPermissionNames.filter((p) =>
      p.startsWith("DEVICE_")
    );
    const sitePerms = allPermissionNames.filter((p) => p.startsWith("SITE_"));

    const isGroup = orgType === "group";
    const orgId = organization._id;
    const orgTitle = isGroup ? organization.grp_title : organization.net_name;
    const orgSlug = isGroup
      ? organization.organization_slug
      : organization.net_acronym;

    const organizationName =
      this.normalizeName(orgTitle) ||
      this.normalizeName(orgSlug) ||
      `${orgType.toUpperCase()}_${orgId.toString().slice(-6).toUpperCase()}`;

    const roleTemplates = [
      {
        type: "SUPER_ADMIN",
        description: `Super Administrator for ${orgTitle}`,
        permissions: [
          isGroup ? constants.GROUP_MANAGEMENT : constants.NETWORK_MANAGEMENT,
          constants.ORG_USER_ASSIGN,
          constants.USER_MANAGEMENT,
          constants.ROLE_ASSIGNMENT,
          constants.SETTINGS_EDIT,
          constants.ANALYTICS_VIEW,
          constants.SYSTEM_ADMIN,
          constants.SUPER_ADMIN,
        ],
      },
      {
        type: "ADMIN",
        description: `Administrator for ${orgTitle}`,
        permissions: [
          isGroup ? constants.GROUP_VIEW : constants.NETWORK_VIEW,
          isGroup ? constants.GROUP_EDIT : constants.NETWORK_EDIT,
          constants.ORG_USER_ASSIGN,
          constants.USER_MANAGEMENT,
          constants.MEMBER_VIEW,
          constants.MEMBER_INVITE,
          constants.MEMBER_REMOVE,
          constants.SETTINGS_VIEW,
          ...(isGroup && constants.GROUP_SETTINGS
            ? [constants.GROUP_SETTINGS]
            : []),
          constants.ROLE_VIEW,
          // DEVICE
          ...devicePerms,
          // SITE
          ...sitePerms,
          // ANALYTICS
          constants.DASHBOARD_VIEW,
          constants.ANALYTICS_VIEW,
          constants.ANALYTICS_EXPORT,
          constants.DATA_VIEW,
          constants.DATA_EXPORT,
          constants.DATA_COMPARE,
        ],
      },
      {
        type: "MANAGER",
        description: `Manager for ${orgTitle}`,
        permissions: [
          isGroup ? constants.GROUP_VIEW : constants.NETWORK_VIEW,
          constants.MEMBER_VIEW,
          constants.ORG_USER_ASSIGN,
          constants.MEMBER_INVITE,
          constants.DASHBOARD_VIEW,
          constants.ANALYTICS_VIEW,
          constants.SETTINGS_VIEW,
          ...(isGroup ? [constants.CONTENT_MODERATION] : []),
        ],
      },
      {
        type: "DEFAULT_MEMBER",
        description: `Default Member role for ${orgTitle}`,
        permissions: [
          isGroup ? constants.GROUP_VIEW : constants.NETWORK_VIEW,
          constants.MEMBER_VIEW,
          constants.DASHBOARD_VIEW,
          ...(isGroup ? [constants.CONTENT_VIEW] : []),
        ],
      },
    ];

    for (const template of roleTemplates) {
      const roleData = {
        role_name: `${organizationName}_${template.type}`,
        role_code: `${organizationName}_${template.type}`,
        role_description: template.description,
        permissions: template.permissions,
      };

      try {
        const existingRoleFilter = {
          role_name: roleData.role_name,
          [isGroup ? "group_id" : "network_id"]: orgId,
        };

        const existingRole = await RoleModel(this.tenant)
          .findOne(existingRoleFilter)
          .lean();

        if (existingRole) {
          if (!dryRun) {
            await this.updateRolePermissions(
              existingRole,
              roleData.permissions
            );
          }
          this.results.roles.updated++;
          continue;
        }

        if (!dryRun) {
          const permissions = await PermissionModel(this.tenant)
            .find({ permission: { $in: roleData.permissions } })
            .select("_id")
            .lean();
          const permissionIds = permissions.map((p) => p._id);

          await RoleModel(this.tenant).create({
            ...roleData,
            [isGroup ? "group_id" : "network_id"]: orgId,
            role_permissions: permissionIds,
          });
        }

        this.results.roles.created++;
      } catch (error) {
        this.results.roles.errors.push({
          roleName: roleData.role_name,
          orgId: orgId,
          error: error.message,
        });
        logger.error(
          `Error creating role ${roleData.role_name} for ${orgType} ${orgTitle}: ${error.message}`
        );
      }
    }
  }

  /**
   * Create default roles for a specific group
   * @param {Object} organization - Group or Network object
   * @param {string} orgType - 'group' or 'network'
   * @param {boolean} dryRun - Whether to actually create roles
   */
  async createGroupDefaultRoles(group, dryRun = false) {
    await this._createOrganizationDefaultRoles(group, "group", dryRun);
  }

  /**
   * Create default roles for a specific network
   * @param {Object} network - Network object
   * @param {boolean} dryRun - Whether to actually create roles
   */
  async createNetworkDefaultRoles(network, dryRun = false) {
    await this._createOrganizationDefaultRoles(network, "network", dryRun);
  }

  /**
   * Update role permissions
   * @param {Object} role - Existing role
   * @param {Array} permissionNames - Array of permission names
   */
  async updateRolePermissions(role, permissionNames) {
    const permissions = await PermissionModel(this.tenant)
      .find({ permission: { $in: permissionNames } })
      .select("_id")
      .lean();

    const permissionIds = permissions.map((p) => p._id);

    await RoleModel(this.tenant).findByIdAndUpdate(role._id, {
      $addToSet: { role_permissions: { $each: permissionIds } },
    });
  }

  /**
   * Migrate existing user roles to new format
   * @param {boolean} dryRun - Whether to actually update users
   */
  async migrateUserRoles(dryRun = false) {
    logger.info("Migrating user roles...");

    const users = await UserModel(this.tenant)
      .find({
        $or: [
          { group_roles: { $exists: true, $ne: [] } },
          { network_roles: { $exists: true, $ne: [] } },
        ],
      })
      .lean();

    // Pre-fetch all groups and roles to reduce database queries
    const allGroups = await GroupModel(this.tenant).find({}).lean();
    const allRoles = await RoleModel(this.tenant).find({}).lean();

    // Create lookup maps for better performance
    const groupMap = new Map(allGroups.map((g) => [g._id.toString(), g]));
    const roleMap = new Map();

    // Create role lookup by group and role name
    allRoles.forEach((role) => {
      const key = `${role.group_id}_${role.role_name}`;
      roleMap.set(key, role);
    });

    for (const user of users) {
      try {
        let needsUpdate = false;
        const updates = {};

        // Process group roles
        if (user.group_roles && user.group_roles.length > 0) {
          const updatedGroupRoles = [];

          for (const groupRole of user.group_roles) {
            if (!groupRole.role || groupRole.role === null) {
              // Get group from our pre-fetched map
              const group = groupMap.get(groupRole.group.toString());
              if (group) {
                const organizationName = this.normalizeName(group.grp_title);
                const defaultRoleName = `${organizationName}_DEFAULT_MEMBER`;
                const roleKey = `${groupRole.group}_${this.normalizeName(
                  defaultRoleName
                )}`;
                const defaultRole = roleMap.get(roleKey);

                if (defaultRole) {
                  updatedGroupRoles.push({
                    ...groupRole,
                    role: defaultRole._id,
                    userType: groupRole.userType || "guest",
                  });
                  needsUpdate = true;
                } else {
                  logger.warn(
                    `Default role not found for group: ${group.grp_title}`
                  );
                  updatedGroupRoles.push(groupRole);
                }
              } else {
                logger.warn(`Group not found for ID: ${groupRole.group}`);
                updatedGroupRoles.push(groupRole);
              }
            } else {
              updatedGroupRoles.push(groupRole);
            }
          }

          if (needsUpdate) {
            updates.group_roles = updatedGroupRoles;
          }
        }

        // Process network roles (similar logic for when NetworkModel is available)
        if (user.network_roles && user.network_roles.length > 0) {
          // Add network role migration logic here when NetworkModel is ready
          // For now, we'll just preserve existing network roles
          updates.network_roles = user.network_roles;
        }

        if (needsUpdate && !dryRun) {
          await UserModel(this.tenant).findByIdAndUpdate(user._id, updates);
          this.results.users.updated++;
          logger.debug(`Updated user roles for: ${user.email}`);
        } else if (!needsUpdate) {
          this.results.users.skipped++;
        }
      } catch (error) {
        this.results.users.errors.push({
          userId: user._id,
          email: user.email,
          error: error.message,
        });
        logger.error(`Error migrating user ${user.email}: ${error.message}`);
      }
    }

    logger.info(
      `Users updated: ${this.results.users.updated}, skipped: ${this.results.users.skipped}`
    );
  }

  /**
   * Get default role for a group
   * @param {string|ObjectId} groupId - Group ID
   * @returns {Promise<Object|null>} Default role or null
   */
  async getDefaultGroupRole(groupId) {
    try {
      const group = await GroupModel(this.tenant).findById(groupId).lean();
      if (!group) {
        logger.warn(`Group not found for ID: ${groupId}`);
        return null;
      }

      const organizationName = this.normalizeName(group.grp_title);
      const defaultRoleName = `${organizationName}_DEFAULT_MEMBER`;

      const defaultRole = await RoleModel(this.tenant)
        .findOne({
          role_name: defaultRoleName,
          group_id: groupId,
        })
        .lean();

      if (!defaultRole) {
        logger.warn(`Default role not found for group: ${group.grp_title}`);
      }

      return defaultRole;
    } catch (error) {
      logger.error(
        `Error getting default group role for ${groupId}: ${error.message}`
      );
      return null;
    }
  }

  /**
   * Validate migration results
   */
  async validateMigration() {
    logger.info("Validating migration results...");

    // Check if all groups have default roles
    const groups = await GroupModel(this.tenant).find({}).lean();
    for (const group of groups) {
      const roleCount = await RoleModel(this.tenant).countDocuments({
        group_id: group._id,
      });

      if (roleCount === 0) {
        logger.warn(`Group ${group.grp_title} has no roles assigned`);
      }
    }

    // Check for users without roles
    const usersWithoutRoles = await UserModel(this.tenant)
      .find({
        $and: [
          {
            $or: [
              { group_roles: { $size: 0 } },
              { group_roles: { $exists: false } },
            ],
          },
          {
            $or: [
              { network_roles: { $size: 0 } },
              { network_roles: { $exists: false } },
            ],
          },
        ],
      })
      .countDocuments();

    if (usersWithoutRoles > 0) {
      logger.warn(
        `${usersWithoutRoles} users have no group or network roles assigned`
      );
    }

    // Check for roles without permissions
    const rolesWithoutPermissions = await RoleModel(this.tenant)
      .find({
        $or: [
          { role_permissions: { $size: 0 } },
          { role_permissions: { $exists: false } },
        ],
      })
      .countDocuments();

    if (rolesWithoutPermissions > 0) {
      logger.warn(
        `${rolesWithoutPermissions} roles have no permissions assigned`
      );
    }

    logger.info("Migration validation completed");
  }

  /**
   * Generate migration summary
   * @returns {Object} Summary of migration results
   */
  generateSummary() {
    const totalErrors =
      this.results.permissions.errors.length +
      this.results.roles.errors.length +
      this.results.users.errors.length +
      this.results.groups.errors.length;

    return {
      totalPermissionsCreated: this.results.permissions.created,
      totalRolesCreated: this.results.roles.created,
      totalRolesUpdated: this.results.roles.updated,
      totalUsersUpdated: this.results.users.updated,
      totalGroupsProcessed: this.results.groups.processed,
      totalErrors,
      hasErrors: totalErrors > 0,
      recommendedActions: this.generateRecommendations(),
    };
  }

  /**
   * Generate recommendations based on migration results
   * @returns {Array} Array of recommendation strings
   */
  generateRecommendations() {
    const recommendations = [];

    if (this.results.permissions.errors.length > 0) {
      recommendations.push("Review and fix permission creation errors");
    }

    if (this.results.roles.errors.length > 0) {
      recommendations.push("Review and fix role creation errors");
    }

    if (this.results.users.errors.length > 0) {
      recommendations.push("Review and fix user migration errors");
    }

    if (
      this.results.permissions.created === 0 &&
      this.results.permissions.skipped > 0
    ) {
      recommendations.push(
        "All permissions already exist - consider reviewing permission structure"
      );
    }

    if (this.results.roles.created > 0) {
      recommendations.push(
        "Clear RBAC cache after migration to ensure new roles are recognized"
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "Migration completed successfully - no additional actions required"
      );
    }

    return recommendations;
  }

  /**
   * Clean up migration utility resources
   */
  cleanup() {
    // Clean up any resources if needed
    logger.info("RBAC migration utility cleanup completed");
  }
}

module.exports = RBACMigrationUtility;
