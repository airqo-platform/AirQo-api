// utils/rbac-migration.util.js
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const GroupModel = require("@models/Group");
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
    return name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
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
    logger.info("Creating default permissions...");

    const defaultPermissions = [
      // Group permissions
      {
        permission: "GROUP_VIEW",
        description: "View group information and basic details",
      },
      { permission: "GROUP_CREATE", description: "Create new groups" },
      {
        permission: "GROUP_EDIT",
        description: "Edit group settings and information",
      },
      { permission: "GROUP_DELETE", description: "Delete groups" },
      {
        permission: "GROUP_MANAGEMENT",
        description: "Full group management access",
      },

      // Member permissions
      { permission: "MEMBER_VIEW", description: "View group members" },
      {
        permission: "MEMBER_INVITE",
        description: "Invite new members to group",
      },
      { permission: "MEMBER_REMOVE", description: "Remove members from group" },
      { permission: "MEMBER_SEARCH", description: "Search group members" },
      { permission: "MEMBER_EXPORT", description: "Export member data" },

      // User management permissions
      { permission: "USER_VIEW", description: "View user information" },
      { permission: "USER_CREATE", description: "Create new users" },
      { permission: "USER_EDIT", description: "Edit user information" },
      { permission: "USER_DELETE", description: "Delete users" },
      {
        permission: "USER_MANAGEMENT",
        description: "Full user management access",
      },
      {
        permission: "GROUP_USER_ASSIGN",
        description: "Assign users to groups",
      },

      // Role and permission management
      {
        permission: "ROLE_VIEW",
        description: "View roles and their permissions",
      },
      { permission: "ROLE_CREATE", description: "Create new roles" },
      { permission: "ROLE_EDIT", description: "Edit existing roles" },
      { permission: "ROLE_DELETE", description: "Delete roles" },
      { permission: "ROLE_ASSIGNMENT", description: "Assign roles to users" },

      // Dashboard and analytics
      { permission: "DASHBOARD_VIEW", description: "View dashboard" },
      {
        permission: "ANALYTICS_VIEW",
        description: "View analytics and reports",
      },
      { permission: "ANALYTICS_EXPORT", description: "Export analytics data" },

      // Settings permissions
      {
        permission: "SETTINGS_VIEW",
        description: "View system and group settings",
      },
      {
        permission: "SETTINGS_EDIT",
        description: "Edit system and group settings",
      },
      {
        permission: "GROUP_SETTINGS",
        description: "Manage group-specific settings",
      },

      // System administration
      {
        permission: "SYSTEM_ADMIN",
        description: "System administration access",
      },
      {
        permission: "DATABASE_ADMIN",
        description: "Database administration access",
      },
      { permission: "SUPER_ADMIN", description: "Super administrator access" },

      // Content and moderation
      { permission: "CONTENT_VIEW", description: "View content" },
      { permission: "CONTENT_CREATE", description: "Create content" },
      { permission: "CONTENT_EDIT", description: "Edit content" },
      { permission: "CONTENT_DELETE", description: "Delete content" },
      { permission: "CONTENT_MODERATION", description: "Moderate content" },

      // Activity and audit
      { permission: "ACTIVITY_VIEW", description: "View activity logs" },
      { permission: "AUDIT_VIEW", description: "View audit trails" },
      { permission: "REPORT_GENERATE", description: "Generate reports" },

      // Network permissions (for future use)
      { permission: "NETWORK_VIEW", description: "View network information" },
      { permission: "NETWORK_CREATE", description: "Create new networks" },
      { permission: "NETWORK_EDIT", description: "Edit network settings" },
      { permission: "NETWORK_DELETE", description: "Delete networks" },
      {
        permission: "NETWORK_MANAGEMENT",
        description: "Full network management access",
      },
    ];

    for (const permissionData of defaultPermissions) {
      try {
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
    logger.info("Creating default roles for groups...");

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
  }

  /**
   * Create default roles for a specific group
   * @param {Object} group - Group object
   * @param {boolean} dryRun - Whether to actually create roles
   */
  async createGroupDefaultRoles(group, dryRun = false) {
    const organizationName = this.normalizeName(group.grp_title);

    const defaultRoles = [
      {
        role_name: `${organizationName}_SUPER_ADMIN`,
        role_code: `${organizationName}_SUPER_ADMIN`,
        role_description: `Super Administrator for ${group.grp_title}`,
        permissions: [
          "GROUP_MANAGEMENT",
          "USER_MANAGEMENT",
          "ROLE_ASSIGNMENT",
          "SETTINGS_EDIT",
          "ANALYTICS_VIEW",
          "SYSTEM_ADMIN",
          "SUPER_ADMIN",
        ],
      },
      {
        role_name: `${organizationName}_GROUP_ADMIN`,
        role_code: `${organizationName}_GROUP_ADMIN`,
        role_description: `Group Administrator for ${group.grp_title}`,
        permissions: [
          "GROUP_EDIT",
          "USER_MANAGEMENT",
          "MEMBER_VIEW",
          "MEMBER_INVITE",
          "MEMBER_REMOVE",
          "SETTINGS_VIEW",
          "ANALYTICS_VIEW",
          "ROLE_VIEW",
        ],
      },
      {
        role_name: `${organizationName}_GROUP_MANAGER`,
        role_code: `${organizationName}_GROUP_MANAGER`,
        role_description: `Group Manager for ${group.grp_title}`,
        permissions: [
          "GROUP_VIEW",
          "MEMBER_VIEW",
          "MEMBER_INVITE",
          "DASHBOARD_VIEW",
          "ANALYTICS_VIEW",
          "SETTINGS_VIEW",
          "CONTENT_MODERATION",
        ],
      },
      {
        role_name: `${organizationName}_DEFAULT_MEMBER`,
        role_code: `${organizationName}_DEFAULT_MEMBER`,
        role_description: `Default Member role for ${group.grp_title}`,
        permissions: [
          "GROUP_VIEW",
          "MEMBER_VIEW",
          "DASHBOARD_VIEW",
          "CONTENT_VIEW",
        ],
      },
    ];

    for (const roleData of defaultRoles) {
      try {
        const existingRole = await RoleModel(this.tenant)
          .findOne({
            role_name: roleData.role_name,
            group_id: group._id,
          })
          .lean();

        if (existingRole) {
          // Update existing role with new permissions if needed
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
          // Get permission IDs
          const permissions = await PermissionModel(this.tenant)
            .find({ permission: { $in: roleData.permissions } })
            .select("_id")
            .lean();

          const permissionIds = permissions.map((p) => p._id);

          // Create role
          const newRole = await RoleModel(this.tenant).create({
            role_name: roleData.role_name,
            role_code: roleData.role_code,
            role_description: roleData.role_description,
            group_id: group._id,
            role_permissions: permissionIds,
            role_status: "ACTIVE",
          });

          logger.debug(
            `Created role: ${roleData.role_name} for group: ${group.grp_title}`
          );
        }

        this.results.roles.created++;
      } catch (error) {
        this.results.roles.errors.push({
          roleName: roleData.role_name,
          groupId: group._id,
          error: error.message,
        });
        logger.error(
          `Error creating role ${roleData.role_name}: ${error.message}`
        );
      }
    }
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
                const organizationName = group.grp_title.toUpperCase();
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
