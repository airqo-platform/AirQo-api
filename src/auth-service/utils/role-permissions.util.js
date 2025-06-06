const PermissionModel = require("@models/Permission");
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const { logObject, logText, HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- role-permissions util`
);
const ORGANISATIONS_LIMIT = constants.ORGANISATIONS_LIMIT || 6;

const convertToUpperCaseWithUnderscore = (inputString, next) => {
  try {
    const uppercaseString = inputString.toUpperCase();
    const transformedString = uppercaseString.replace(/ /g, "_");
    return transformedString;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};
const isGroupRoleOrNetworkRole = (role) => {
  logObject("role", role);
  if (role && (role.group_id || role.network_id)) {
    if (role.group_id && !role.network_id) {
      return "group";
    } else if (!role.group_id && role.network_id) {
      return "network";
    } else {
      return "none";
    }
  }
  return "none";
};
const findAssociatedIdForRole = async ({
  role_id,
  tenant = "airqo",
  roles,
} = {}) => {
  for (const role of roles) {
    const RoleDetails = await RoleModel(tenant).findById(role_id).lean();
    logObject("RoleDetails", RoleDetails);
    if (
      role.network &&
      role.network.toString() === RoleDetails.network_id.toString()
    ) {
      return role.network;
    } else if (
      role.group &&
      role.group.toString() === RoleDetails.group_id.toString()
    ) {
      return role.group;
    }
  }
  return null;
};
const isAssignedUserSuperAdmin = async ({
  associatedId,
  roles = [],
  tenant = "airqo",
}) => {
  for (const role of roles) {
    if (
      (role.network && role.network.toString() === associatedId.toString()) ||
      (role.group && role.group.toString() === associatedId.toString())
    ) {
      const RoleDetails = await RoleModel(tenant)
        .findById(ObjectId(role.role))
        .lean();
      if (
        RoleDetails &&
        RoleDetails.role_name &&
        RoleDetails.role_name.endsWith("SUPER_ADMIN")
      ) {
        return true;
      }
    }
  }

  return false;
};
const isRoleAlreadyAssigned = (roles, role_id) => {
  if (isEmpty(roles) || !Array.isArray(roles)) {
    return false;
  } else {
    return roles.some((role) => {
      if (isEmpty(role.role)) {
        return false;
      }
      logObject("role.role.toString()", role.role.toString());
      logObject("role_id.toString()", role_id.toString());
      return role.role.toString() === role_id.toString();
    });
  }
};

/**
 * Setup default permissions and roles for the system
 * Called at application startup
 */
const setupDefaultPermissions = async (tenant = "airqo") => {
  try {
    console.log(
      `🚀 Setting up default permissions and roles for tenant: ${tenant}`
    );

    const defaultPermissions = [
      // === System Administration ===
      {
        permission: "SYSTEM_ADMIN",
        description: "System-wide administrative access",
      },
      {
        permission: "SUPER_ADMIN",
        description: "Super administrator with all permissions",
      },
      {
        permission: "DATABASE_ADMIN",
        description: "Database administration access",
      },

      // === Organization Management ===
      {
        permission: "ORG_CREATE",
        description: "Create new organizations",
      },
      {
        permission: "ORG_VIEW",
        description: "View organization information",
      },
      {
        permission: "ORG_UPDATE",
        description: "Update organization settings",
      },
      {
        permission: "ORG_DELETE",
        description: "Delete organizations",
      },
      {
        permission: "ORG_APPROVE",
        description: "Approve organization requests",
      },
      {
        permission: "ORG_REJECT",
        description: "Reject organization requests",
      },

      // === Group Management ===
      {
        permission: "GROUP_VIEW",
        description: "View group information and basic details",
      },
      {
        permission: "GROUP_CREATE",
        description: "Create new groups",
      },
      {
        permission: "GROUP_EDIT",
        description: "Edit group settings and information",
      },
      {
        permission: "GROUP_DELETE",
        description: "Delete groups",
      },
      {
        permission: "GROUP_MANAGEMENT",
        description: "Full group management access",
      },

      // === User Management ===
      {
        permission: "USER_VIEW",
        description: "View user information",
      },
      {
        permission: "USER_CREATE",
        description: "Create new users",
      },
      {
        permission: "USER_EDIT",
        description: "Edit user information",
      },
      {
        permission: "USER_DELETE",
        description: "Delete users",
      },
      {
        permission: "USER_MANAGEMENT",
        description: "Full user management access",
      },
      {
        permission: "USER_INVITE",
        description: "Invite new users to organization",
      },

      // === Member Management ===
      {
        permission: "MEMBER_VIEW",
        description: "View organization members",
      },
      {
        permission: "MEMBER_INVITE",
        description: "Invite new members to organization",
      },
      {
        permission: "MEMBER_REMOVE",
        description: "Remove members from organization",
      },
      {
        permission: "MEMBER_SEARCH",
        description: "Search organization members",
      },
      {
        permission: "MEMBER_EXPORT",
        description: "Export member data",
      },

      // === Role and Permission Management ===
      {
        permission: "ROLE_VIEW",
        description: "View roles and their permissions",
      },
      {
        permission: "ROLE_CREATE",
        description: "Create new roles",
      },
      {
        permission: "ROLE_EDIT",
        description: "Edit existing roles",
      },
      {
        permission: "ROLE_DELETE",
        description: "Delete roles",
      },
      {
        permission: "ROLE_ASSIGNMENT",
        description: "Assign roles to users",
      },

      // === Device Management (from requirements) ===
      {
        permission: "DEVICE_VIEW",
        description: "View device information",
      },
      {
        permission: "DEVICE_DEPLOY",
        description: "Deploy devices to sites",
      },
      {
        permission: "DEVICE_RECALL",
        description: "Recall devices from deployment",
      },
      {
        permission: "DEVICE_MAINTAIN",
        description: "Perform device maintenance",
      },
      {
        permission: "DEVICE_UPDATE",
        description: "Update device configuration",
      },
      {
        permission: "DEVICE_DELETE",
        description: "Delete device records",
      },

      // === Site Management ===
      {
        permission: "SITE_VIEW",
        description: "View site information",
      },
      {
        permission: "SITE_CREATE",
        description: "Create new sites",
      },
      {
        permission: "SITE_UPDATE",
        description: "Update site information",
      },
      {
        permission: "SITE_DELETE",
        description: "Delete sites",
      },

      // === Dashboard and Analytics ===
      {
        permission: "DASHBOARD_VIEW",
        description: "View dashboard",
      },
      {
        permission: "ANALYTICS_VIEW",
        description: "View analytics and reports",
      },
      {
        permission: "ANALYTICS_EXPORT",
        description: "Export analytics data",
      },
      {
        permission: "DATA_VIEW",
        description: "View data",
      },
      {
        permission: "DATA_EXPORT",
        description: "Export data",
      },
      {
        permission: "DATA_COMPARE",
        description: "Compare data across sources",
      },

      // === Settings and Configuration ===
      {
        permission: "SETTINGS_VIEW",
        description: "View system and organization settings",
      },
      {
        permission: "SETTINGS_EDIT",
        description: "Edit system and organization settings",
      },
      {
        permission: "GROUP_SETTINGS",
        description: "Manage group-specific settings",
      },

      // === Content Management ===
      {
        permission: "CONTENT_VIEW",
        description: "View content",
      },
      {
        permission: "CONTENT_CREATE",
        description: "Create content",
      },
      {
        permission: "CONTENT_EDIT",
        description: "Edit content",
      },
      {
        permission: "CONTENT_DELETE",
        description: "Delete content",
      },
      {
        permission: "CONTENT_MODERATION",
        description: "Moderate content",
      },

      // === Activity and Audit ===
      {
        permission: "ACTIVITY_VIEW",
        description: "View activity logs",
      },
      {
        permission: "AUDIT_VIEW",
        description: "View audit trails",
      },
      {
        permission: "AUDIT_EXPORT",
        description: "Export audit logs",
      },
      {
        permission: "REPORT_GENERATE",
        description: "Generate reports",
      },

      // === API and Integration ===
      {
        permission: "API_ACCESS",
        description: "Access API endpoints",
      },
      {
        permission: "TOKEN_GENERATE",
        description: "Generate API tokens",
      },
      {
        permission: "TOKEN_MANAGE",
        description: "Manage API tokens",
      },

      // === Network Management ===
      {
        permission: "NETWORK_VIEW",
        description: "View network information",
      },
      {
        permission: "NETWORK_CREATE",
        description: "Create new networks",
      },
      {
        permission: "NETWORK_EDIT",
        description: "Edit network settings",
      },
      {
        permission: "NETWORK_DELETE",
        description: "Delete networks",
      },
      {
        permission: "NETWORK_MANAGEMENT",
        description: "Full network management access",
      },
    ];

    // Create default permissions
    for (const permissionData of defaultPermissions) {
      try {
        const existingPermission = await PermissionModel(tenant)
          .findOne({ permission: permissionData.permission })
          .lean();

        if (!existingPermission) {
          await PermissionModel(tenant).create(permissionData);
          console.log(`✅ Created permission: ${permissionData.permission}`);
        } else {
          console.log(
            `⏭️  Permission already exists: ${permissionData.permission}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error creating permission ${permissionData.permission}: ${error.message}`
        );
      }
    }

    // Create AirQo organization if it doesn't exist
    const GroupModel = require("@models/Group");
    let airqoGroup = await GroupModel(tenant).findOne({
      grp_title: { $regex: /^airqo$/i },
    });

    if (!airqoGroup) {
      airqoGroup = await GroupModel(tenant).create({
        grp_title: "AirQo",
        grp_description: "AirQo Organization - System Administrator Group",
        grp_status: "ACTIVE",
        organization_slug: "airqo",
      });
      console.log("✅ Created AirQo organization");
    }

    // Define default roles for AirQo organization
    const defaultRoles = [
      {
        role_name: "AIRQO_SUPER_ADMIN",
        role_code: "AIRQO_SUPER_ADMIN",
        role_description: "AirQo Super Administrator with all permissions",
        group_id: airqoGroup._id,
        permissions: [
          "SUPER_ADMIN",
          "SYSTEM_ADMIN",
          "DATABASE_ADMIN",
          "ORG_CREATE",
          "ORG_VIEW",
          "ORG_UPDATE",
          "ORG_DELETE",
          "ORG_APPROVE",
          "ORG_REJECT",
          "GROUP_MANAGEMENT",
          "USER_MANAGEMENT",
          "ROLE_ASSIGNMENT",
          "SETTINGS_EDIT",
          "ANALYTICS_VIEW",
          "AUDIT_VIEW",
          "AUDIT_EXPORT",
          "DEVICE_VIEW",
          "DEVICE_DEPLOY",
          "DEVICE_RECALL",
          "DEVICE_MAINTAIN",
          "DEVICE_UPDATE",
          "DEVICE_DELETE",
          "SITE_VIEW",
          "SITE_CREATE",
          "SITE_UPDATE",
          "SITE_DELETE",
          "API_ACCESS",
          "TOKEN_GENERATE",
          "TOKEN_MANAGE",
          "NETWORK_MANAGEMENT",
        ],
      },
      {
        role_name: "AIRQO_ADMIN",
        role_code: "AIRQO_ADMIN",
        role_description: "AirQo Administrator",
        group_id: airqoGroup._id,
        permissions: [
          "ORG_VIEW",
          "ORG_APPROVE",
          "ORG_REJECT",
          "GROUP_VIEW",
          "GROUP_EDIT",
          "USER_MANAGEMENT",
          "MEMBER_VIEW",
          "MEMBER_INVITE",
          "MEMBER_REMOVE",
          "ROLE_VIEW",
          "ROLE_ASSIGNMENT",
          "SETTINGS_VIEW",
          "ANALYTICS_VIEW",
          "DEVICE_VIEW",
          "DEVICE_DEPLOY",
          "DEVICE_MAINTAIN",
          "SITE_VIEW",
          "SITE_CREATE",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "DATA_EXPORT",
        ],
      },
    ];

    // Create system-wide default role templates
    const organizationRoleTemplates = [
      {
        role_name: "{ORG}_SUPER_ADMIN",
        role_description: "Super Administrator for {ORG}",
        permissions: [
          "GROUP_MANAGEMENT",
          "USER_MANAGEMENT",
          "ROLE_ASSIGNMENT",
          "SETTINGS_EDIT",
          "ANALYTICS_VIEW",
          "DEVICE_VIEW",
          "DEVICE_DEPLOY",
          "DEVICE_MAINTAIN",
          "SITE_VIEW",
          "SITE_CREATE",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "DATA_EXPORT",
          "MEMBER_VIEW",
          "MEMBER_INVITE",
          "MEMBER_REMOVE",
          "API_ACCESS",
          "TOKEN_GENERATE",
        ],
      },
      {
        role_name: "{ORG}_ADMIN",
        role_description: "Administrator for {ORG}",
        permissions: [
          "GROUP_VIEW",
          "GROUP_EDIT",
          "USER_MANAGEMENT",
          "MEMBER_VIEW",
          "MEMBER_INVITE",
          "MEMBER_REMOVE",
          "ROLE_VIEW",
          "SETTINGS_VIEW",
          "ANALYTICS_VIEW",
          "DEVICE_VIEW",
          "DEVICE_DEPLOY",
          "DEVICE_MAINTAIN",
          "SITE_VIEW",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "DATA_EXPORT",
        ],
      },
      {
        role_name: "{ORG}_TECHNICIAN",
        role_description: "Field Technician for {ORG}",
        permissions: [
          "GROUP_VIEW",
          "DEVICE_VIEW",
          "DEVICE_DEPLOY",
          "DEVICE_MAINTAIN",
          "SITE_VIEW",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "MEMBER_VIEW",
        ],
      },
      {
        role_name: "{ORG}_ANALYST",
        role_description: "Data Analyst for {ORG}",
        permissions: [
          "GROUP_VIEW",
          "ANALYTICS_VIEW",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "DATA_EXPORT",
          "DATA_COMPARE",
          "DEVICE_VIEW",
          "SITE_VIEW",
          "MEMBER_VIEW",
        ],
      },
      {
        role_name: "{ORG}_DEVELOPER",
        role_description: "Developer for {ORG}",
        permissions: [
          "GROUP_VIEW",
          "API_ACCESS",
          "TOKEN_GENERATE",
          "TOKEN_MANAGE",
          "DATA_VIEW",
          "DATA_EXPORT",
          "DEVICE_VIEW",
          "SITE_VIEW",
          "DASHBOARD_VIEW",
        ],
      },
      {
        role_name: "{ORG}_VIEWER",
        role_description: "Read-only Viewer for {ORG}",
        permissions: [
          "GROUP_VIEW",
          "DEVICE_VIEW",
          "SITE_VIEW",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "MEMBER_VIEW",
        ],
      },
    ];

    // Create AirQo-specific roles
    const roleCreationResults = [];
    for (const roleData of defaultRoles) {
      try {
        const result = await createOrUpdateRole(tenant, roleData);
        if (result) {
          roleCreationResults.push(result);
        }
      } catch (error) {
        console.error(
          `❌ Failed to create role ${roleData.role_name}: ${error.message}`
        );
        // Continue with other roles even if one fails
        continue;
      }
    }

    console.log(
      "🎉 Default permissions and roles setup completed successfully!"
    );

    return {
      success: true,
      message: "Default permissions and roles setup complete",
      data: {
        permissions_created: defaultPermissions.length,
        roles_processed: defaultRoles.length,
        roles_created: roleCreationResults.length,
        organization: airqoGroup.grp_title,
      },
    };
  } catch (error) {
    console.error(`❌ Error setting up default permissions: ${error.message}`);
    throw error;
  }
};

/**
 * Helper function to create or update a role with E11000 duplicate handling
 * Inspired by the register function pattern
 */
const createOrUpdateRole = async (tenant, roleData) => {
  try {
    console.log(`🔍 Processing role: ${roleData.role_name}`);

    // Get permission IDs for the role
    const permissions = await PermissionModel(tenant)
      .find({ permission: { $in: roleData.permissions } })
      .select("_id")
      .lean();

    const permissionIds = permissions.map((p) => p._id);

    // Try to create the role directly
    const newRole = await RoleModel(tenant).create({
      role_name: roleData.role_name,
      role_code: roleData.role_code || roleData.role_name,
      role_description: roleData.role_description,
      group_id: roleData.group_id,
      network_id: roleData.network_id, // Include network_id if provided
      role_permissions: permissionIds,
      role_status: "ACTIVE",
    });

    console.log(`✅ Created new role: ${roleData.role_name}`);
    return {
      success: true,
      data: newRole,
      message: `Role ${roleData.role_name} created successfully`,
      status: httpStatus.OK,
    };
  } catch (err) {
    console.log(`⚠️  Error creating role ${roleData.role_name}:`, err.message);

    // Handle E11000 duplicate key error specifically
    if (err.code === 11000) {
      console.log(
        `🔄 Duplicate detected for role: ${roleData.role_name}, finding existing...`
      );

      try {
        // Try multiple search strategies to find the existing role
        const searchStrategies = [
          { role_code: roleData.role_code || roleData.role_name },
          { role_name: roleData.role_name },
          {
            role_name: roleData.role_name,
            group_id: roleData.group_id,
          },
        ];

        let existingRole = null;
        for (const searchQuery of searchStrategies) {
          existingRole = await RoleModel(tenant).findOne(searchQuery).lean();
          if (existingRole) {
            console.log(
              `✅ Found existing role: ${existingRole.role_name} (ID: ${existingRole._id})`
            );
            break;
          }
        }

        if (existingRole) {
          // Optionally update permissions on existing role
          try {
            const permissions = await PermissionModel(tenant)
              .find({ permission: { $in: roleData.permissions } })
              .select("_id")
              .lean();

            const permissionIds = permissions.map((p) => p._id);

            const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
              existingRole._id,
              {
                role_description: roleData.role_description,
                role_permissions: permissionIds,
                role_status: "ACTIVE",
                updatedAt: new Date(),
              },
              { new: true }
            );

            console.log(`🔄 Updated existing role: ${roleData.role_name}`);

            return {
              success: true,
              data: updatedRole || existingRole,
              message: `Role ${roleData.role_name} already exists and was updated`,
              status: httpStatus.OK,
            };
          } catch (updateError) {
            console.log(
              `⚠️  Update failed, using existing role: ${roleData.role_name}`
            );
            return {
              success: true,
              data: existingRole,
              message: `Role ${roleData.role_name} already exists`,
              status: httpStatus.OK,
            };
          }
        } else {
          // Could not find existing role even though duplicate error occurred
          console.log(
            `❌ Duplicate error but role not found: ${roleData.role_name}`
          );

          // Extract duplicate field info from error
          let duplicateField = "role_code";
          let duplicateValue = roleData.role_code || roleData.role_name;

          if (err.keyValue) {
            const [key, value] = Object.entries(err.keyValue)[0];
            duplicateField = key;
            duplicateValue = value;
          }

          return {
            success: false,
            message:
              "Duplicate role detected but could not locate existing role",
            status: httpStatus.CONFLICT,
            errors: {
              [duplicateField]: `the ${duplicateField} must be unique`,
              message: `Role with ${duplicateField} '${duplicateValue}' already exists`,
              suggestion: "Try using a different role name or code",
            },
          };
        }
      } catch (findError) {
        console.error(`❌ Error finding existing role: ${findError.message}`);
        return {
          success: false,
          message: "Duplicate role error and failed to find existing role",
          status: httpStatus.CONFLICT,
          errors: {
            message: `Role ${roleData.role_name} appears to be duplicate but could not be located`,
            original_error: err.message,
            search_error: findError.message,
          },
        };
      }
    } else if (err.keyValue) {
      // Handle other duplicate field errors
      let response = {};
      Object.entries(err.keyValue).forEach(([key, value]) => {
        response[key] = `the ${key} must be unique`;
      });

      return {
        success: false,
        message: "Validation errors for some of the provided fields",
        status: httpStatus.CONFLICT,
        errors: response,
      };
    } else if (err.errors) {
      // Handle validation errors
      let response = {};
      Object.entries(err.errors).forEach(([key, value]) => {
        response[key] = value.message;
      });

      return {
        success: false,
        message: "Validation errors for some of the provided fields",
        status: httpStatus.CONFLICT,
        errors: response,
      };
    } else {
      // Handle other errors
      console.error(
        `❌ Unexpected error creating role ${roleData.role_name}: ${err.message}`
      );
      return {
        success: false,
        message: "Error creating role",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: err.message,
        },
      };
    }
  }
};

/**
 * Create default roles for a new organization
 * Uses improved E11000 duplicate handling
 */
const createDefaultRolesForOrganization = async (
  groupId,
  organizationName,
  tenant = "airqo"
) => {
  try {
    const orgName = organizationName.toUpperCase().replace(/[^A-Z0-9]/g, "_");

    const roleTemplates = [
      {
        role_name: `${orgName}_SUPER_ADMIN`,
        role_description: `Super Administrator for ${organizationName}`,
        permissions: [
          "GROUP_MANAGEMENT",
          "USER_MANAGEMENT",
          "ROLE_ASSIGNMENT",
          "SETTINGS_EDIT",
          "ANALYTICS_VIEW",
          "DEVICE_VIEW",
          "DEVICE_DEPLOY",
          "DEVICE_MAINTAIN",
          "SITE_VIEW",
          "SITE_CREATE",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "DATA_EXPORT",
          "MEMBER_VIEW",
          "MEMBER_INVITE",
          "MEMBER_REMOVE",
          "API_ACCESS",
          "TOKEN_GENERATE",
        ],
      },
      {
        role_name: `${orgName}_ADMIN`,
        role_description: `Administrator for ${organizationName}`,
        permissions: [
          "GROUP_VIEW",
          "GROUP_EDIT",
          "USER_MANAGEMENT",
          "MEMBER_VIEW",
          "MEMBER_INVITE",
          "MEMBER_REMOVE",
          "ROLE_VIEW",
          "SETTINGS_VIEW",
          "ANALYTICS_VIEW",
          "DEVICE_VIEW",
          "DEVICE_DEPLOY",
          "DEVICE_MAINTAIN",
          "SITE_VIEW",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "DATA_EXPORT",
        ],
      },
      {
        role_name: `${orgName}_DEFAULT_MEMBER`,
        role_description: `Default Member role for ${organizationName}`,
        permissions: [
          "GROUP_VIEW",
          "MEMBER_VIEW",
          "DASHBOARD_VIEW",
          "DATA_VIEW",
          "DEVICE_VIEW",
          "SITE_VIEW",
        ],
      },
    ];

    const createdRoles = [];
    const roleErrors = [];

    for (const roleTemplate of roleTemplates) {
      try {
        const roleData = {
          ...roleTemplate,
          group_id: groupId,
          role_code: roleTemplate.role_name,
        };

        const result = await createOrUpdateRole(tenant, roleData);

        if (result.success) {
          createdRoles.push(result.data);
          console.log(
            `✅ Created role for ${organizationName}: ${roleTemplate.role_name}`
          );
        } else {
          roleErrors.push({
            role_name: roleTemplate.role_name,
            error: result.message,
            details: result.errors,
          });
          console.error(
            `❌ Failed to create role ${roleTemplate.role_name}: ${result.message}`
          );
        }
      } catch (error) {
        roleErrors.push({
          role_name: roleTemplate.role_name,
          error: error.message,
          type: "unexpected_error",
        });
        console.error(
          `❌ Unexpected error creating role ${roleTemplate.role_name}: ${error.message}`
        );
        // Continue with other roles
        continue;
      }
    }

    return {
      success: roleErrors.length === 0,
      data: {
        roles_created: createdRoles,
        roles_failed: roleErrors,
        organization_name: organizationName,
        total_attempted: roleTemplates.length,
        successful_count: createdRoles.length,
        failed_count: roleErrors.length,
      },
      message:
        roleErrors.length === 0
          ? `All default roles created for ${organizationName}`
          : `Some roles failed to create for ${organizationName}`,
    };
  } catch (error) {
    console.error(
      `Error creating roles for organization ${organizationName}: ${error.message}`
    );
    return {
      success: false,
      message: `Failed to create roles for ${organizationName}`,
      error: error.message,
    };
  }
};

/**
 * Reset/cleanup RBAC data (use with caution!)
 */
const resetRBACData = async (tenant = "airqo", options = {}) => {
  try {
    const {
      resetPermissions = false,
      resetRoles = false,
      resetUserRoles = false,
      dryRun = true,
    } = options;

    console.log(
      `🧹 ${dryRun ? "DRY RUN:" : ""} Resetting RBAC data for tenant: ${tenant}`
    );

    const results = {
      permissions_deleted: 0,
      roles_deleted: 0,
      users_updated: 0,
      errors: [],
    };

    if (resetUserRoles) {
      const updateResult = await UserModel(tenant).updateMany(
        {},
        {
          $unset: {
            group_roles: 1,
            network_roles: 1,
            // Optionally clear deprecated fields too
            role: 1,
            privilege: 1,
          },
        },
        { dryRun }
      );
      results.users_updated = updateResult.modifiedCount || 0;
      console.log(
        `${dryRun ? "[DRY RUN]" : ""} Updated ${results.users_updated} users`
      );
    }

    if (resetRoles) {
      const deleteResult = await RoleModel(tenant).deleteMany({}, { dryRun });
      results.roles_deleted = deleteResult.deletedCount || 0;
      console.log(
        `${dryRun ? "[DRY RUN]" : ""} Deleted ${results.roles_deleted} roles`
      );
    }

    if (resetPermissions) {
      const deleteResult = await PermissionModel(tenant).deleteMany(
        {},
        { dryRun }
      );
      results.permissions_deleted = deleteResult.deletedCount || 0;
      console.log(
        `${dryRun ? "[DRY RUN]" : ""} Deleted ${
          results.permissions_deleted
        } permissions`
      );
    }

    return {
      success: true,
      message: `${dryRun ? "DRY RUN: " : ""}RBAC reset completed`,
      data: results,
    };
  } catch (error) {
    console.error(`❌ Error resetting RBAC data: ${error.message}`);
    throw error;
  }
};

/**
 * Ensure AIRQO_SUPER_ADMIN role exists (fallback utility)
 * Uses E11000 duplicate handling pattern
 */
const ensureSuperAdminRole = async (tenant = "airqo") => {
  try {
    console.log("🔍 Ensuring AIRQO_SUPER_ADMIN role exists...");

    // Try to find existing super admin role first
    let superAdminRole = await RoleModel(tenant)
      .findOne({
        $or: [
          { role_code: "AIRQO_SUPER_ADMIN" },
          { role_name: "AIRQO_SUPER_ADMIN" },
        ],
      })
      .lean();

    if (superAdminRole) {
      console.log(
        `✅ Found existing AIRQO_SUPER_ADMIN role (ID: ${superAdminRole._id})`
      );
      return superAdminRole;
    }

    console.log("🆕 AIRQO_SUPER_ADMIN role not found, creating...");

    // Get or create AirQo group
    const GroupModel = require("@models/Group");
    let airqoGroup = await GroupModel(tenant).findOne({
      grp_title: { $regex: /^airqo$/i },
    });

    if (!airqoGroup) {
      airqoGroup = await GroupModel(tenant).create({
        grp_title: "AirQo",
        grp_description: "AirQo Organization - System Administrator Group",
        grp_status: "ACTIVE",
        organization_slug: "airqo",
      });
      console.log("✅ Created AirQo organization");
    }

    // Get some basic permissions (create minimal set if none exist)
    let basicPermissions = await PermissionModel(tenant)
      .find({
        permission: {
          $in: [
            "SUPER_ADMIN",
            "SYSTEM_ADMIN",
            "GROUP_MANAGEMENT",
            "USER_MANAGEMENT",
          ],
        },
      })
      .select("_id")
      .lean();

    // If no permissions exist, create minimal set
    if (basicPermissions.length === 0) {
      console.log("⚠️  No permissions found, creating minimal set...");

      const minimalPermissions = [
        {
          permission: "SUPER_ADMIN",
          description: "Super administrator access",
        },
        {
          permission: "SYSTEM_ADMIN",
          description: "System administrator access",
        },
        {
          permission: "GROUP_MANAGEMENT",
          description: "Group management access",
        },
        {
          permission: "USER_MANAGEMENT",
          description: "User management access",
        },
      ];

      for (const permData of minimalPermissions) {
        try {
          const newPerm = await PermissionModel(tenant).create(permData);
          basicPermissions.push({ _id: newPerm._id });
          console.log(`✅ Created permission: ${permData.permission}`);
        } catch (permError) {
          if (permError.code === 11000) {
            // Permission already exists, find it
            const existingPerm = await PermissionModel(tenant)
              .findOne({ permission: permData.permission })
              .select("_id")
              .lean();
            if (existingPerm) {
              basicPermissions.push(existingPerm);
            }
          }
        }
      }
    }

    const permissionIds = basicPermissions.map((p) => p._id);

    // Use the E11000 pattern to create the super admin role
    try {
      superAdminRole = await RoleModel(tenant).create({
        role_name: "AIRQO_SUPER_ADMIN",
        role_code: "AIRQO_SUPER_ADMIN",
        role_description: "AirQo Super Administrator with all permissions",
        group_id: airqoGroup._id,
        role_permissions: permissionIds,
        role_status: "ACTIVE",
      });

      console.log(
        `✅ Created AIRQO_SUPER_ADMIN role (ID: ${superAdminRole._id})`
      );
      return superAdminRole;
    } catch (err) {
      console.log(`⚠️  Error creating super admin role:`, err.message);

      // Handle E11000 duplicate key error
      if (err.code === 11000) {
        console.log("🔄 Duplicate detected, searching for existing role...");

        // Try to find the existing role
        superAdminRole = await RoleModel(tenant)
          .findOne({
            $or: [
              { role_code: "AIRQO_SUPER_ADMIN" },
              { role_name: "AIRQO_SUPER_ADMIN" },
            ],
          })
          .lean();

        if (superAdminRole) {
          console.log(
            `✅ Found existing role after duplicate error (ID: ${superAdminRole._id})`
          );
          return superAdminRole;
        } else {
          console.error("❌ Duplicate error but could not find existing role");
          throw new Error(
            "AIRQO_SUPER_ADMIN role appears to exist but could not be located"
          );
        }
      } else {
        // Some other error occurred
        throw err;
      }
    }
  } catch (error) {
    console.error(`❌ Error ensuring super admin role: ${error.message}`);
    throw error;
  }
};

const rolePermissionUtil = {
  /******* roles *******************************************/
  listRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);
      const responseFromListRole = await RoleModel(tenant.toLowerCase()).list(
        {
          filter,
        },
        next
      );
      return responseFromListRole;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  listRolesForGroup: async (request, next) => {
    try {
      const { query, params } = request;
      const { grp_id, tenant } = { ...query, ...params };

      const group = await GroupModel(tenant).findById(grp_id);
      if (!group) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Group ${grp_id.toString()} Not Found`,
          })
        );
      }

      const roleResponse = await RoleModel(tenant).aggregate([
        {
          $match: {
            group_id: ObjectId(grp_id),
          },
        },
        {
          $lookup: {
            from: "permissions",
            localField: "role_permissions",
            foreignField: "_id",
            as: "role_permissions",
          },
        },
        {
          $project: {
            _id: 1,
            role_name: 1,
            role_permissions: {
              $map: {
                input: "$role_permissions",
                as: "role_permission",
                in: {
                  _id: "$$role_permission._id",
                  permission: "$$role_permission.permission",
                },
              },
            },
          },
        },
      ]);

      if (!isEmpty(roleResponse)) {
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: roleResponse,
        };
      } else if (isEmpty(roleResponse)) {
        return {
          success: true,
          message: "No roles for this Group",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteRole: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);

      if (isEmpty(filter._id)) {
        next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message:
              "the role ID is missing -- required when updating corresponding users",
          })
        );
      }

      const result = await UserModel(tenant).updateMany(
        {
          $or: [
            { "network_roles.role": filter._id },
            { "group_roles.role": filter._id },
          ],
        },
        { $set: { "network_roles.$.role": null, "group_roles.$.role": null } }
      );

      if (result.nModified > 0) {
        logger.info(
          `Removed role ${filter._id} from ${result.nModified} users.`
        );
      }

      if (result.n === 0) {
        logger.info(
          `Role ${filter._id} was not found in any users' network_roles or group_roles.`
        );
      }
      const responseFromDeleteRole = await RoleModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      logObject("responseFromDeleteRole", responseFromDeleteRole);
      return responseFromDeleteRole;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateRole: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request, next);
      const update = Object.assign({}, body);

      const responseFromUpdateRole = await RoleModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateRole;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createRole: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      let newBody = Object.assign({}, body);
      let organizationName;

      if (body.group_id) {
        const group = await GroupModel(tenant).findById(body.group_id);
        if (isEmpty(group)) {
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided group ${body.group_id} is invalid, please crosscheck`,
            })
          );
        }
        organizationName = group.grp_title.toUpperCase();
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Either network_id or group_id must be provided",
          })
        );
      }

      const transformedRoleName = convertToUpperCaseWithUnderscore(
        body.role_name
      );
      const availableRoleCode = body.role_code
        ? body.role_code
        : body.role_name;
      const transformedRoleCode =
        convertToUpperCaseWithUnderscore(availableRoleCode);

      newBody.role_name = `${organizationName}_${transformedRoleName}`;
      newBody.role_code = `${organizationName}_${transformedRoleCode}`;

      const responseFromCreateRole = await RoleModel(
        tenant.toLowerCase()
      ).register(newBody, next);

      return responseFromCreateRole;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAvailableUsersForRole: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { role_id } = request.params;

      const role = await RoleModel(tenant).findById(role_id);

      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid role ID ${role_id}, please crosscheck`,
          })
        );
      }

      const roleType = role.network_id ? "Network" : "Group";
      const query = roleType === "Network" ? "network_roles" : "group_roles";

      const responseFromListAvailableUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              [query]: {
                $not: {
                  $elemMatch: {
                    role: role_id,
                  },
                },
              },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      return {
        success: true,
        message: `Retrieved all available users for the ${roleType} role ${role_id}`,
        data: responseFromListAvailableUsers,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignUserToRole: async (request, next) => {
    try {
      const { role_id, user_id } = request.params;
      const { tenant, user } = { ...request.body, ...request.query };
      const userIdFromBody = user;
      const userIdFromQuery = user_id;

      if (!isEmpty(userIdFromBody) && !isEmpty(userIdFromQuery)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide the user ID using query params and query body; choose one approach",
          })
        );
      }

      const userId = userIdFromQuery || userIdFromBody;
      logObject("userId", userId);

      const role = await RoleModel(tenant).findById(role_id).lean();

      const userExists = await UserModel(tenant).exists({ _id: userId });
      const roleExists = await RoleModel(tenant).exists({ _id: role_id });

      if (!userExists || !roleExists) {
        next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} or Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const isNetworkRole = roleType === "network";

      const userObject = await UserModel(tenant)
        .findById(userId)
        .populate(isNetworkRole ? "network_roles" : "group_roles")
        .lean();

      const userRoles = isNetworkRole
        ? userObject.network_roles
        : userObject.group_roles;
      logObject("userRoles", userRoles);
      const roles = userRoles || [];
      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

      logObject("isRoleAssigned", isRoleAssigned);

      if (isRoleAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${userObject._id.toString()} is already assigned to the role ${role_id.toString()}`,
          })
        );
      }

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The ROLE ${role_id} is not associated with any of the ${
              isNetworkRole ? "networks" : "groups"
            } already assigned to USER ${userObject._id}`,
          })
        );
      }

      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles: userRoles,
        tenant,
      });

      if (isSuperAdmin) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER ADMIN user ${userObject._id} cannot be reassigned to a different role`,
          })
        );
      }

      const updateQuery = {
        $addToSet: {
          [isNetworkRole ? "network_roles" : "group_roles"]: {
            ...(isNetworkRole
              ? { network: associatedId }
              : { group: associatedId }),
            role: role_id,
            userType: "guest", // Optional: adding default user type
            createdAt: new Date(),
          },
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userObject._id },
        updateQuery,
        { new: true, runValidators: true }
      );

      if (updatedUser) {
        return {
          success: true,
          message: "User assigned to the Role",
          data: updatedUser,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Failed to assign user" }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignManyUsersToRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, user_ids } = { ...body, ...query, ...params };
      const roleObject = await RoleModel(tenant).findById(role_id).lean();

      if (isEmpty(roleObject)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} does not exist`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(roleObject);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const assignUserPromises = [];
      const isNetworkRole = roleType === "network";

      const users = await UserModel(tenant)
        .find({ _id: { $in: user_ids } })
        .populate(isNetworkRole ? "network_roles" : "group_roles")
        .lean();

      for (const user of users) {
        if (isEmpty(user)) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: { message: `One of the Users does not exist` },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const userRoles = isNetworkRole ? user.network_roles : user.group_roles;

        const roles = userRoles || [];
        logObject("roles", roles);

        const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

        if (isRoleAssigned) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user._id.toString()} is already assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const associatedId = await findAssociatedIdForRole({
          role_id,
          roles,
          tenant,
        });

        if (isEmpty(associatedId)) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `The ROLE ${role_id} is not associated with any of the ${
                isNetworkRole ? "networks" : "groups"
              } already assigned to USER ${user._id}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const isSuperAdmin = await isAssignedUserSuperAdmin({
          associatedId,
          roles: userRoles,
          tenant,
        });

        if (isSuperAdmin) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER ADMIN user ${user._id} can not be reassigned to a different role`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const updateQuery = {
          $set: {
            [isNetworkRole ? "network_roles" : "group_roles"]: {
              [isNetworkRole ? "network" : "group"]: associatedId,
              role: role_id,
            },
          },
        };

        await UserModel(tenant).updateOne({ _id: user._id }, updateQuery);

        assignUserPromises.push(null);
      }

      const assignUserResults = await Promise.all(assignUserPromises);
      const successfulAssignments = assignUserResults.filter(
        (result) => result === null
      );
      const unsuccessfulAssignments = assignUserResults.filter(
        (result) => result !== null
      );

      if (
        successfulAssignments.length > 0 &&
        unsuccessfulAssignments.length > 0
      ) {
        return {
          success: true,
          message: "Some users were successfully assigned to the role.",
          data: { unsuccessfulAssignments },
          status: httpStatus.OK,
        };
      } else if (
        unsuccessfulAssignments.length > 0 &&
        successfulAssignments.length === 0
      ) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "None of the provided users could be assigned to the role.",
            unsuccessfulAssignments,
          })
        );
      } else {
        return {
          success: true,
          message: "All provided users were successfully assigned to the role.",
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listUsersWithRole: async (request, next) => {
    try {
      logText("listUsersWithRole...");
      const { query, params } = request;
      const { role_id, tenant } = { ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);

      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid role ID ${role_id.toString()}, please crosscheck`,
          })
        );
      }

      const networkRoleFilter = { "network_roles.role": ObjectId(role_id) };
      const groupRoleFilter = { "group_roles.role": ObjectId(role_id) };

      const responseFromListAssignedUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              $or: [networkRoleFilter, groupRoleFilter],
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      logObject("responseFromListAssignedUsers", responseFromListAssignedUsers);

      return {
        success: true,
        message: `retrieved all assigned users for role ${role_id}`,
        data: responseFromListAssignedUsers,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  unAssignUserFromRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { role_id, user_id, tenant } = { ...query, ...params };

      const [userObject, role, userExists, roleExists] = await Promise.all([
        UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean(),
        RoleModel(tenant).findById(role_id).lean(),
        UserModel(tenant).exists({ _id: user_id }),
        RoleModel(tenant).exists({ _id: role_id }),
      ]);

      if (!userExists || !roleExists) {
        next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} or Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);

      if (roleType === "none") {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const { network_roles, group_roles } = userObject;
      const roles = roleType === "network" ? network_roles : group_roles;

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The ROLE ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to USER ${user_id}`,
          })
        );
      }

      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles,
        tenant,
      });

      if (isSuperAdmin) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
          })
        );
      }

      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

      if (!isRoleAssigned) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
          })
        );
      }

      const filter = {
        _id: user_id,
        [`${roleType}_roles.${roleType}`]: associatedId,
      };
      const update = {
        $set: { [`${roleType}_roles.$[elem].role`]: null },
      };

      const arrayFilters = [{ "elem.role": role_id }];

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        filter,
        update,
        { new: true, arrayFilters }
      );

      if (isEmpty(updatedUser)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "User not found or not assigned to the specified Role in the Network or Group provided",
          })
        );
      }

      return {
        success: true,
        message: "User unassigned from the role",
        data: updatedUser,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  unAssignManyUsersFromRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, user_ids } = { ...body, ...query, ...params };
      const roleObject = await RoleModel(tenant).findById(role_id).lean();
      if (isEmpty(roleObject)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if all provided users actually exist
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id"
      );

      const nonExistentUsers = user_ids.filter(
        (user_id) => !existingUsers.some((user) => user._id.equals(user_id))
      );

      if (nonExistentUsers.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The following users do not exist: ${nonExistentUsers.join(
              ", "
            )}`,
          })
        );
      }

      const unAssignUserPromises = [];

      for (const user_id of user_ids) {
        const userObject = await UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean();

        const { network_roles, group_roles } = userObject;
        logObject("roleObject", roleObject);
        const roleType = isGroupRoleOrNetworkRole(roleObject);
        logObject("roleType", roleType);

        if (roleType === "none") {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Role ${role_id.toString()} is not associated with any network or group`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const roles = roleType === "network" ? network_roles : group_roles;
        const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

        if (!isRoleAssigned) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const associatedId = await findAssociatedIdForRole({
          role_id,
          roles,
          tenant,
        });

        if (!associatedId) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `The ROLE ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to USER ${user_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const isSuperAdmin = await isAssignedUserSuperAdmin({
          associatedId,
          roles,
          tenant,
        });

        if (isSuperAdmin) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const updateQuery = {
          $set: { [`${roleType}_roles.$[elem].role`]: null },
        };

        const updateResult = await UserModel(tenant).updateOne(
          { _id: user_id },
          updateQuery,
          { arrayFilters: [{ "elem.role": role_id }] }
        );

        if (updateResult.nModified !== 1) {
          unAssignUserPromises.push({
            success: false,
            message: "Could not unassign all users from the role.",
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
          continue;
        }

        unAssignUserPromises.push(null);
      }

      const assignUserResults = await Promise.all(unAssignUserPromises);

      const successfulUnassignments = assignUserResults.filter(
        (result) => result === null
      );
      const unsuccessfulUnAssignments = assignUserResults.filter(
        (result) => result !== null
      );

      let success, message, status;

      if (
        successfulUnassignments.length > 0 &&
        unsuccessfulUnAssignments.length > 0
      ) {
        success = true;
        message = "Some users were successfully unassigned from the role";
        status = httpStatus.OK;
      } else if (
        unsuccessfulUnAssignments.length > 0 &&
        successfulUnassignments.length === 0
      ) {
        success = false;
        message = "Bad Request Error";
        status = httpStatus.BAD_REQUEST;
      } else {
        success = true;
        message =
          "All provided users were successfully unassigned from the role.";
        status = httpStatus.OK;
      }

      const response = {
        success,
        message,
        status,
      };

      if (success) {
        response.data = { unsuccessfulUnAssignments };
      } else {
        response.errors = {
          message:
            "None of the provided users could be unassigned from the role.",
          unsuccessfulUnAssignments,
        };
      }
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listPermissionsForRole: async (request, next) => {
    try {
      logText("listPermissionsForRole...");
      const { query, params } = request;
      const { role_id, tenant, limit, skip } = { ...query, ...params };
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;
      const filter = generateFilter.roles(newRequest, next);
      const listRoleResponse = await RoleModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      if (listRoleResponse.success === true) {
        if (
          listRoleResponse.message === "roles not found for this operation" ||
          isEmpty(listRoleResponse.data)
        ) {
          return listRoleResponse;
        }

        const permissions = listRoleResponse.data[0].role_permissions;
        const permissionsArray = permissions.map((obj) => obj.permission);
        filter = { permission: { $in: permissionsArray } };
        let responseFromListPermissions = await PermissionModel(tenant).list(
          {
            skip,
            limit,
            filter,
          },
          next
        );
        return responseFromListPermissions;
      } else if (listRoleResponse.success === false) {
        return listRoleResponse;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAvailablePermissionsForRole: async (request, next) => {
    try {
      logText("listAvailablePermissionsForRole...");
      const { query, params } = request;
      const { role_id, tenant, limit, skip } = { ...query, ...params };
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;
      const filter = generateFilter.roles(newRequest, next);
      const listRoleResponse = await RoleModel(tenant).list(
        {
          skip,
          limit,
          filter,
        },
        next
      );

      if (listRoleResponse.success === true) {
        if (
          listRoleResponse.message === "roles not found for this operation" ||
          isEmpty(listRoleResponse.data)
        ) {
          return listRoleResponse;
        }

        const permissions = listRoleResponse.data[0].role_permissions;
        const permissionsArray = permissions.map((obj) => obj.permission);
        filter = { permission: { $nin: permissionsArray } };
        let responseFromListPermissions = await PermissionModel(tenant).list(
          {
            skip,
            limit,
            filter,
          },
          next
        );
        return responseFromListPermissions;
      } else if (listRoleResponse.success === false) {
        return listRoleResponse;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  assignPermissionsToRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permissions } = { ...body, ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} Not Found`,
          })
        );
      }

      const permissionsResponse = await PermissionModel(tenant).find({
        _id: { $in: permissions.map((id) => ObjectId(id)) },
      });

      if (permissionsResponse.length !== permissions.length) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "not all provided permissions exist, please crosscheck",
          })
        );
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      logObject("assignedPermissions", assignedPermissions);

      const alreadyAssigned = permissions.filter((permission) =>
        assignedPermissions.includes(permission)
      );

      logObject("alreadyAssigned", alreadyAssigned);

      if (alreadyAssigned.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Some permissions already assigned to the Role ${role_id.toString()}, they include: ${alreadyAssigned.join(
              ","
            )}`,
          })
        );
      }
      const updatedRole = await RoleModel(tenant).findOneAndUpdate(
        { _id: role_id },
        { $addToSet: { role_permissions: { $each: permissions } } },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions added successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to update Role",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getDefaultGroupRole: async (tenant, groupId) => {
    try {
      const group = await GroupModel(tenant).findById(groupId).lean();

      if (!group) {
        return null;
      }

      const organizationName = group.grp_title.toUpperCase();
      const defaultRoleCode = `${organizationName}_DEFAULT_MEMBER`; //  dynamically create the role code
      let role = await RoleModel(tenant).findOne({
        role_code: defaultRoleCode,
      });

      if (!role) {
        const roleDocument = {
          role_code: defaultRoleCode,
          role_name: defaultRoleCode, // Use the same naming convention as other group roles
          description: "Default role for new group members",
          group_id: groupId, // Associate the role with the group.
        };
        role = await RoleModel(tenant).create(roleDocument);

        // Assign some default permissions to the newly created role here. For Example:
        const defaultPermissions = await PermissionModel(tenant).find({
          permission: { $in: constants.DEFAULT_MEMBER_PERMISSIONS },
        });

        if (defaultPermissions.length > 0) {
          await RoleModel(tenant).findByIdAndUpdate(role._id, {
            $addToSet: {
              role_permissions: {
                $each: defaultPermissions.map((permission) => permission._id),
              },
            },
          });
        }
      }

      return role;
    } catch (error) {
      logger.error("Error getting default group role:", error);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  unAssignPermissionFromRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { role_id, permission_id, tenant } = { ...query, ...params };

      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} Not Found`,
          })
        );
      }

      const filter = { _id: role_id };
      const update = { $pull: { role_permissions: permission_id } };

      const permission = await PermissionModel(tenant).findById(permission_id);
      if (!permission) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permission ${permission_id.toString()} Not Found`,
          })
        );
      }

      const roleResponse = await RoleModel(tenant).findOne({
        _id: role_id,
        role_permissions: permission_id,
      });

      if (!roleResponse) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permission ${permission_id.toString()} is not assigned to the Role ${role_id.toString()}`,
          })
        );
      }

      const responseFromUnAssignPermissionFromRole = await RoleModel(
        tenant
      ).modify(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromUnAssignPermissionFromRole.success === true) {
        let modifiedResponse = Object.assign(
          {},
          responseFromUnAssignPermissionFromRole
        );
        if (
          responseFromUnAssignPermissionFromRole.message ===
          "successfully modified the Permission"
        ) {
          modifiedResponse.message = "permission has been unassigned from role";
        }
        return modifiedResponse;
      } else if (responseFromUnAssignPermissionFromRole.success === false) {
        return responseFromUnAssignPermissionFromRole;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  unAssignManyPermissionsFromRole: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permission_ids } = {
        ...body,
        ...query,
        ...params,
      };

      // Check if role exists
      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if any of the provided permission IDs don't exist
      const permissions = await PermissionModel(tenant).find({
        _id: { $in: permission_ids },
      });
      const missingPermissions = permission_ids.filter((permission_id) => {
        return !permissions.some((permission) =>
          permission._id.equals(permission_id)
        );
      });
      if (missingPermissions.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permissions not found: ${missingPermissions.join(", ")}`,
          })
        );
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      const notAssigned = permission_ids.filter(
        (permission) => !assignedPermissions.includes(permission)
      );

      if (notAssigned.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Some of the provided permissions are not assigned to the Role ${role_id.toString()}, they include: ${notAssigned.join(
              ", "
            )}`,
          })
        );
      }

      const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
        role_id,
        { $pull: { role_permissions: { $in: permission_ids } } },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions removed successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to remove the permissions",
          })
        );
      }

      return {
        success: true,
        message: `permissions successfully unassigned from the role.`,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateRolePermissions: async (request, next) => {
    try {
      const { query, params, body } = request;
      const { role_id, tenant, permission_ids } = {
        ...body,
        ...query,
        ...params,
      };

      // Check if role exists
      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      // Check if any of the provided permission IDs don't exist
      const permissions = await PermissionModel(tenant).find({
        _id: { $in: permission_ids },
      });
      const missingPermissions = permission_ids.filter((permission_id) => {
        return !permissions.some((permission) =>
          permission._id.equals(permission_id)
        );
      });
      if (missingPermissions.length > 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Permissions not found: ${missingPermissions.join(", ")}`,
          })
        );
      }

      const uniquePermissions = [...new Set(permission_ids)];

      const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
        role_id,
        { role_permissions: uniquePermissions },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions updated successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to update the permissions",
          })
        );
      }

      return {
        success: true,
        message: `permissions successfully updated.`,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /******* permissions *******************************************/
  listPermission: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.permissions(request, next);
      const responseFromListPermissions = await PermissionModel(
        tenant.toLowerCase()
      ).list(
        {
          filter,
        },
        next
      );
      return responseFromListPermissions;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deletePermission: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.permissions(request, next);
      const responseFromDeletePermission = await PermissionModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromDeletePermission;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updatePermission: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const update = body;
      const filter = generateFilter.permissions(request, next);
      const responseFromUpdatePermission = await PermissionModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdatePermission;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createPermission: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const responseFromCreatePermission = await PermissionModel(
        tenant.toLowerCase()
      ).register(body, next);
      return responseFromCreatePermission;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  /**
   * Get detailed role summary for a user
   */
  getUserRoleSummary: async (userId, tenant) => {
    try {
      const user = await UserModel(tenant)
        .findById(userId)
        .populate("network_roles.role")
        .populate("group_roles.role")
        .populate("network_roles.network")
        .populate("group_roles.group")
        .lean();

      if (!user) {
        return null;
      }

      const networkRoles = (user.network_roles || []).map((nr) => ({
        role_id: nr.role?._id,
        role_name: nr.role?.role_name,
        network_id: nr.network?._id,
        network_name: nr.network?.net_name,
        userType: nr.userType,
        createdAt: nr.createdAt,
      }));

      const groupRoles = (user.group_roles || []).map((gr) => ({
        role_id: gr.role?._id,
        role_name: gr.role?.role_name,
        group_id: gr.group?._id,
        group_name: gr.group?.grp_title,
        userType: gr.userType,
        createdAt: gr.createdAt,
      }));

      return {
        user_id: userId,
        network_roles: {
          count: networkRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: ORGANISATIONS_LIMIT - networkRoles.length,
          roles: networkRoles,
        },
        group_roles: {
          count: groupRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: ORGANISATIONS_LIMIT - groupRoles.length,
          roles: groupRoles,
        },
        total_roles: networkRoles.length + groupRoles.length,
      };
    } catch (error) {
      logger.error(`Error getting user role summary: ${error.message}`);
      return null;
    }
  },

  /**
   * Enhanced assign user to role with detailed response
   */
  enhancedAssignUserToRole: async (request, next) => {
    try {
      const { role_id, user_id } = request.params;
      const { tenant, user } = { ...request.body, ...request.query };
      const userIdFromBody = user;
      const userIdFromQuery = user_id;

      if (!isEmpty(userIdFromBody) && !isEmpty(userIdFromQuery)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You cannot provide the user ID using query params and query body; choose one approach",
          })
        );
      }

      const userId = userIdFromQuery || userIdFromBody;

      const initialSummary = await rolePermissionUtil.getUserRoleSummary(
        userId,
        tenant
      );
      if (!initialSummary) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} not found`,
          })
        );
      }

      const role = await RoleModel(tenant).findById(role_id).lean();
      const roleExists = await RoleModel(tenant).exists({ _id: role_id });

      if (!roleExists) {
        return next(
          new HttpError("Role not found", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);
      if (roleType === "none") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const isNetworkRole = roleType === "network";
      const currentRoles = isNetworkRole
        ? initialSummary.network_roles
        : initialSummary.group_roles;

      // Check if user has space for this role type
      if (currentRoles.count >= ORGANISATIONS_LIMIT) {
        return next(
          new HttpError("Role Limit Exceeded", httpStatus.BAD_REQUEST, {
            message: `Cannot assign ${roleType} role. User has reached the maximum limit of ${ORGANISATIONS_LIMIT} ${roleType} roles.`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: 0,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Check if role is already assigned
      const isRoleAssigned = currentRoles.roles.some(
        (r) => r.role_id && r.role_id.toString() === role_id.toString()
      );

      if (isRoleAssigned) {
        return next(
          new HttpError("Role Already Assigned", httpStatus.BAD_REQUEST, {
            message: `User already has this ${roleType} role assigned`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Find the associated network/group ID
      const userObject = await UserModel(tenant).findById(userId).lean();
      const userRoles = isNetworkRole
        ? userObject.network_roles
        : userObject.group_roles;
      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles: userRoles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The role ${role_id} is not associated with any of the ${
              isNetworkRole ? "networks" : "groups"
            } already assigned to user ${userId}`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Check for super admin restrictions
      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles: userRoles,
        tenant,
      });

      if (isSuperAdmin) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER ADMIN user ${userId} cannot be reassigned to a different role`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Perform the assignment
      const updateQuery = {
        $addToSet: {
          [isNetworkRole ? "network_roles" : "group_roles"]: {
            ...(isNetworkRole
              ? { network: associatedId }
              : { group: associatedId }),
            role: role_id,
            userType: "guest",
            createdAt: new Date(),
          },
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userId },
        updateQuery,
        { new: true, runValidators: true }
      );

      if (!updatedUser) {
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Failed to assign user to role",
            }
          )
        );
      }

      // Get updated role summary
      const updatedSummary = await rolePermissionUtil.getUserRoleSummary(
        userId,
        tenant
      );

      return {
        success: true,
        message: `User successfully assigned to ${roleType} role`,
        operation: "assign_role",
        role_info: {
          role_id: role_id,
          role_name: role.role_name,
          role_type: roleType,
          associated_id: associatedId,
        },
        before_assignment: initialSummary,
        after_assignment: updatedSummary,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  /**
   * Enhanced unassign user from role with detailed response
   */
  enhancedUnAssignUserFromRole: async (request, next) => {
    try {
      const { query, params } = request;
      const { role_id, user_id, tenant } = { ...query, ...params };

      // Get initial role summary
      const initialSummary = await rolePermissionUtil.getUserRoleSummary(
        user_id,
        tenant
      );
      if (!initialSummary) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      const [userObject, role, userExists, roleExists] = await Promise.all([
        UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean(),
        RoleModel(tenant).findById(role_id).lean(),
        UserModel(tenant).exists({ _id: user_id }),
        RoleModel(tenant).exists({ _id: role_id }),
      ]);

      if (!userExists || !roleExists) {
        return next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} or Role ${role_id} not found`,
          })
        );
      }

      const roleType = isGroupRoleOrNetworkRole(role);
      if (roleType === "none") {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          })
        );
      }

      const { network_roles, group_roles } = userObject;
      const roles = roleType === "network" ? network_roles : group_roles;
      const currentRoles =
        roleType === "network"
          ? initialSummary.network_roles
          : initialSummary.group_roles;

      // Check if role is actually assigned
      const isRoleAssigned = currentRoles.roles.some(
        (r) => r.role_id && r.role_id.toString() === role_id.toString()
      );

      if (!isRoleAssigned) {
        return next(
          new HttpError("Role Not Assigned", httpStatus.BAD_REQUEST, {
            message: `User is not assigned to this ${roleType} role`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The role ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to user ${user_id}`,
          })
        );
      }

      // Check for super admin restrictions
      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles,
        tenant,
      });

      if (isSuperAdmin) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
            current_state: {
              role_type: roleType,
              current_count: currentRoles.count,
              limit: ORGANISATIONS_LIMIT,
              remaining: currentRoles.remaining,
              existing_roles: currentRoles.roles,
            },
          })
        );
      }

      // Perform the unassignment
      const filter = {
        _id: user_id,
        [`${roleType}_roles.${roleType}`]: associatedId,
      };
      const update = {
        $set: { [`${roleType}_roles.$[elem].role`]: null },
      };
      const arrayFilters = [{ "elem.role": role_id }];

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        filter,
        update,
        { new: true, arrayFilters }
      );

      if (isEmpty(updatedUser)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "User not found or not assigned to the specified Role in the Network or Group provided",
          })
        );
      }

      // Get updated role summary
      const updatedSummary = await rolePermissionUtil.getUserRoleSummary(
        user_id,
        tenant
      );

      return {
        success: true,
        message: `User successfully unassigned from ${roleType} role`,
        operation: "unassign_role",
        role_info: {
          role_id: role_id,
          role_name: role.role_name,
          role_type: roleType,
          associated_id: associatedId,
        },
        before_unassignment: initialSummary,
        after_unassignment: updatedSummary,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  /**
   * Get user's network roles only
   */
  getUserNetworkRoles: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant } = request.query;

      const user = await UserModel(tenant)
        .findById(user_id)
        .populate("network_roles.role")
        .populate("network_roles.network")
        .lean();

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      const networkRoles = (user.network_roles || []).map((nr) => ({
        role_id: nr.role?._id,
        role_name: nr.role?.role_name,
        network_id: nr.network?._id,
        network_name: nr.network?.net_name,
        userType: nr.userType,
        createdAt: nr.createdAt,
      }));

      return {
        success: true,
        message: "Successfully retrieved user's network roles",
        data: {
          user_id: user_id,
          role_type: "network",
          count: networkRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: ORGANISATIONS_LIMIT - networkRoles.length,
          roles: networkRoles,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  /**
   * Get user's group roles only
   */
  getUserGroupRoles: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant } = request.query;

      const user = await UserModel(tenant)
        .findById(user_id)
        .populate("group_roles.role")
        .populate("group_roles.group")
        .lean();

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      const groupRoles = (user.group_roles || []).map((gr) => ({
        role_id: gr.role?._id,
        role_name: gr.role?.role_name,
        group_id: gr.group?._id,
        group_name: gr.group?.grp_title,
        userType: gr.userType,
        createdAt: gr.createdAt,
      }));

      return {
        success: true,
        message: "Successfully retrieved user's group roles",
        data: {
          user_id: user_id,
          role_type: "group",
          count: groupRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: ORGANISATIONS_LIMIT - groupRoles.length,
          roles: groupRoles,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  /**
   * Audit deprecated field usage across all users
   */
  auditDeprecatedFieldUsage: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, include_user_details, export_format } = query;

      // Get the audit report from the User model
      const auditResult = await UserModel(tenant).auditDeprecatedFieldUsage(
        next
      );

      if (!auditResult || auditResult.success === false) {
        return auditResult;
      }

      let enhancedReport = auditResult.data;

      // If detailed user information is requested, fetch users with deprecated fields
      if (include_user_details) {
        const usersWithDeprecatedFields = await UserModel(tenant)
          .find({
            $or: [
              { role: { $exists: true, $ne: null } },
              { privilege: { $exists: true, $ne: null } },
              { organization: { $exists: true, $ne: null } },
              { long_organization: { $exists: true, $ne: null } },
            ],
          })
          .select(
            "_id email firstName lastName role privilege organization long_organization createdAt"
          )
          .lean();

        enhancedReport.users_with_deprecated_fields =
          usersWithDeprecatedFields.map((user) => ({
            user_id: user._id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            deprecated_fields_present: {
              role: !!user.role,
              privilege: !!user.privilege,
              organization: !!user.organization,
              long_organization: !!user.long_organization,
            },
            created_at: user.createdAt,
          }));
      }

      // Add migration recommendations
      enhancedReport.migration_recommendations = {
        immediate_actions: [],
        next_steps: [],
        timeline_suggestion: "",
      };

      const { deprecated_field_usage, migration_readiness } = enhancedReport;

      if (migration_readiness.safe_to_migrate) {
        enhancedReport.migration_recommendations.immediate_actions.push(
          "✅ Safe to remove deprecated fields - no users are using them"
        );
        enhancedReport.migration_recommendations.next_steps.push(
          "Update database schema to remove deprecated fields",
          "Update API documentation to reflect changes",
          "Deploy changes to production"
        );
        enhancedReport.migration_recommendations.timeline_suggestion =
          "Can proceed immediately";
      } else {
        const percentage =
          migration_readiness.percentage_using_deprecated_fields;

        if (percentage > 50) {
          enhancedReport.migration_recommendations.immediate_actions.push(
            "⚠️ High usage of deprecated fields detected",
            "Identify and update frontend applications using deprecated fields",
            "Create migration plan for affected users"
          );
          enhancedReport.migration_recommendations.timeline_suggestion =
            "3-6 months migration period recommended";
        } else if (percentage > 10) {
          enhancedReport.migration_recommendations.immediate_actions.push(
            "🔄 Moderate usage of deprecated fields detected",
            "Update remaining frontend applications",
            "Prepare migration notices for affected users"
          );
          enhancedReport.migration_recommendations.timeline_suggestion =
            "1-3 months migration period recommended";
        } else {
          enhancedReport.migration_recommendations.immediate_actions.push(
            "✨ Low usage of deprecated fields detected",
            "Complete final frontend updates",
            "Schedule deprecated field removal"
          );
          enhancedReport.migration_recommendations.timeline_suggestion =
            "2-4 weeks migration period recommended";
        }

        enhancedReport.migration_recommendations.next_steps.push(
          "Send migration notices to affected users",
          "Update API documentation with deprecation warnings",
          "Set up monitoring for deprecated field usage",
          "Plan phased removal of deprecated fields"
        );
      }

      // Add timestamp and audit metadata
      enhancedReport.audit_metadata = {
        audit_timestamp: new Date().toISOString(),
        audited_by: request.user ? request.user.email : "system",
        tenant: tenant,
        total_users_scanned: enhancedReport.total_users,
        audit_scope: include_user_details ? "detailed" : "summary",
      };

      return {
        success: true,
        message: "Deprecated field usage audit completed successfully",
        data: enhancedReport,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  getEnhancedUserDetails: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant, include_deprecated = false } = request.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      const filter = user_id ? { _id: user_id } : {};
      const includeDeprecated = include_deprecated === "true";

      const result = await UserModel(actualTenant).getEnhancedUserDetails(
        { filter, includeDeprecated },
        next
      );

      if (isEmpty(result)) {
        return {
          success: false,
          message: "No user found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      return result;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  etSystemRoleHealth: async (request, next) => {
    try {
      const { tenant } = request.query;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      // Get role distribution statistics
      const roleStats = await UserModel(actualTenant).aggregate([
        {
          $facet: {
            groupRoleStats: [
              {
                $unwind: {
                  path: "$group_roles",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: "roles",
                  localField: "group_roles.role",
                  foreignField: "_id",
                  as: "group_role_details",
                },
              },
              {
                $group: {
                  _id: "$group_role_details.role_name",
                  count: { $sum: 1 },
                },
              },
            ],
            networkRoleStats: [
              {
                $unwind: {
                  path: "$network_roles",
                  preserveNullAndEmptyArrays: true,
                },
              },
              {
                $lookup: {
                  from: "roles",
                  localField: "network_roles.role",
                  foreignField: "_id",
                  as: "network_role_details",
                },
              },
              {
                $group: {
                  _id: "$network_role_details.role_name",
                  count: { $sum: 1 },
                },
              },
            ],
            usersWithoutRoles: [
              {
                $match: {
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
                },
              },
              { $count: "count" },
            ],
            totalUsers: [{ $count: "count" }],
          },
        },
      ]);

      const stats = roleStats[0];
      const totalUsers = stats.totalUsers[0]?.count || 0;
      const usersWithoutRoles = stats.usersWithoutRoles[0]?.count || 0;

      const health = {
        total_users: totalUsers,
        users_without_roles: usersWithoutRoles,
        users_with_roles: totalUsers - usersWithoutRoles,
        coverage_percentage:
          totalUsers > 0
            ? Math.round(((totalUsers - usersWithoutRoles) / totalUsers) * 100)
            : 0,
        group_role_distribution: stats.groupRoleStats.filter(
          (stat) => stat._id && stat._id.length > 0
        ),
        network_role_distribution: stats.networkRoleStats.filter(
          (stat) => stat._id && stat._id.length > 0
        ),
        health_status:
          usersWithoutRoles === 0
            ? "healthy"
            : usersWithoutRoles < totalUsers * 0.1
            ? "good"
            : "needs_attention",
        recommendations: [],
      };

      // Add recommendations based on health status
      if (health.health_status === "needs_attention") {
        health.recommendations.push(
          "Assign roles to users without role assignments"
        );
        health.recommendations.push("Review user onboarding process");
      }

      if (health.coverage_percentage < 90) {
        health.recommendations.push("Improve role assignment coverage");
      }

      return {
        success: true,
        message: "System role health retrieved successfully",
        status: httpStatus.OK,
        data: health,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = {
  ...rolePermissionUtil,
  setupDefaultPermissions,
  createDefaultRolesForOrganization,
  createOrUpdateRole,
  resetRBACData,
  ensureSuperAdminRole,
};
