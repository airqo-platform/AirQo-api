const PermissionModel = require("@models/Permission");
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const TenantSettingsModel = require("@models/TenantSettings");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { logObject, logText, HttpError, stringify } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const RBACService = require("@services/rbac.service");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- role-permissions util`
);
const ORGANISATIONS_LIMIT = constants.ORGANISATIONS_LIMIT || 6;

const normalizeName = (name) => {
  if (!name || typeof name !== "string") {
    return "";
  }
  return name.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
};

// ===== HELPER FUNCTIONS =====

/**
 * Ensures the default "AirQo" group exists, creating it if necessary.
 * @param {string} tenant - The tenant identifier.
 * @returns {Promise<Object>} The AirQo group document.
 */
const getOrCreateAirqoGroup = async (tenant) => {
  const query = { organization_slug: "airqo" };
  const update = {
    $setOnInsert: {
      grp_title: "AirQo",
      grp_description: "The default AirQo organization group",
      grp_status: "ACTIVE",
      organization_slug: "airqo",
    },
  };
  const options = { new: true, upsert: true };
  const airqoGroup = await GroupModel(tenant)
    .findOneAndUpdate(query, update, options)
    .lean();
  return airqoGroup;
};

/**
 * Returns the default role definitions for the AirQo organization.
 * @param {ObjectId} airqoGroupId - The ID of the AirQo group.
 * @returns {Array<Object>} An array of role definition objects.
 */
const getDefaultAirqoRoles = (airqoGroupId) => {
  return Object.values(constants.DEFAULT_ROLE_DEFINITIONS)
    .filter((roleDef) => roleDef.role_name.startsWith("AIRQO_"))
    .map((roleDef) => ({
      ...roleDef,
      group_id: airqoGroupId,
    }));
};

// ===== HELPER FUNCTIONS =====

/**
 * Generate standardized role code from role name and organization
 * @param {string} roleName - The base role name
 * @param {string} organizationName - The organization name
 * @param {string} existingRoleCode - Optional existing role code
 * @returns {string} Generated role code
 */
const generateRoleCode = (
  roleName,
  organizationName = "",
  existingRoleCode = null
) => {
  // If role_code is explicitly provided, use it
  if (existingRoleCode && existingRoleCode.trim()) {
    const transformedRoleCode =
      convertToUpperCaseWithUnderscore(existingRoleCode);
    // Prevent double-prefixing
    if (
      organizationName &&
      !transformedRoleCode.startsWith(`${organizationName}_`)
    ) {
      return `${organizationName}_${transformedRoleCode}`;
    }
    return transformedRoleCode;
  }

  // Auto-generate from role_name
  const transformedRoleName = convertToUpperCaseWithUnderscore(roleName);
  if (
    organizationName &&
    !transformedRoleName.startsWith(`${organizationName}_`)
  ) {
    return `${organizationName}_${transformedRoleName}`;
  }
  return transformedRoleName;
};

/**
 * Check if role code exists and suggest alternatives
 * @param {string} tenant - Tenant name
 * @param {string} baseRoleCode - Base role code to check
 * @param {Object} scopeFilter - Filter for scoping (e.g., { group_id: '...' } or { network_id: '...' })
 * @returns {Promise<Object>} Result with available code or suggestions
 */
const findAvailableRoleCode = async (
  tenant,
  baseRoleCode,
  scopeFilter = {}
) => {
  try {
    // Check if base code is available
    const existingRole = await RoleModel(tenant)
      .findOne({
        role_code: baseRoleCode,
        ...scopeFilter,
      })
      .lean();

    if (!existingRole) {
      return {
        available: true,
        roleCode: baseRoleCode,
        suggestions: [],
      };
    }

    // Generate alternative suggestions
    const suggestions = [];
    for (let i = 1; i <= 5; i++) {
      const alternativeCode = `${baseRoleCode}_${i}`;
      const altExists = await RoleModel(tenant)
        .findOne({
          role_code: alternativeCode,
          ...scopeFilter,
        })
        .lean();

      if (!altExists) {
        suggestions.push(alternativeCode);
      }
    }

    // Try with timestamp suffix
    const timestamp = Date.now().toString().slice(-4);
    const timestampCode = `${baseRoleCode}_${timestamp}`;
    const timestampExists = await RoleModel(tenant)
      .findOne({
        role_code: timestampCode,
        ...scopeFilter,
      })
      .lean();

    if (!timestampExists) {
      suggestions.unshift(timestampCode); // Add to beginning
    }

    return {
      available: false,
      conflictingCode: baseRoleCode,
      suggestions: suggestions.slice(0, 3), // Limit to 3 suggestions
      existingRole: {
        id: existingRole._id,
        name: existingRole.role_name,
        code: existingRole.role_code,
      },
    };
  } catch (error) {
    logObject("Error in findAvailableRoleCode:", error);
    return {
      available: false,
      error: error.message,
      suggestions: [],
    };
  }
};

/**
 * Generate alternative role names when conflicts occur
 * @param {string} baseName - Base role name that conflicts
 * @param {string} tenant - Tenant name
 * @param {string} groupId - Group ID for scoping
 * @returns {Promise<Array>} Array of available alternative names
 */
const generateAlternativeRoleNames = async (
  baseName,
  tenant,
  groupId = null
) => {
  const alternatives = [];
  const suffixes = ["V2", "NEW", "ALT", Date.now().toString().slice(-4)];

  for (const suffix of suffixes) {
    const altName = `${baseName}_${suffix}`;
    const exists = await RoleModel(tenant)
      .findOne({
        role_name: altName,
        ...(groupId && { group_id: groupId }),
      })
      .lean();

    if (!exists) {
      alternatives.push(altName);
    }

    if (alternatives.length >= 3) break; // Limit suggestions
  }

  return alternatives;
};

/**
 * Manually populate role permissions to avoid schema registration issues
 */

const manuallyPopulateRolePermissions = async (role, tenant) => {
  try {
    if (!role) {
      // logObject("⚠️ [DEBUG] No role provided to populate permissions");
      return { role_permissions: [] };
    }

    if (!role.role_permissions || role.role_permissions.length === 0) {
      // logObject("✅ [DEBUG] Role has no permissions to populate");
      return { ...role, role_permissions: [] };
    }

    // Validate permission IDs before querying
    const validPermissionIds = role.role_permissions.filter((permId) => {
      if (!permId) return false;
      if (!mongoose.Types.ObjectId.isValid(permId)) {
        // logObject("⚠️ [DEBUG] Invalid permission ID:", permId);
        return false;
      }
      return true;
    });

    if (validPermissionIds.length === 0) {
      // logObject("⚠️ [DEBUG] No valid permission IDs found");
      return { ...role, role_permissions: [] };
    }

    const permissions = await PermissionModel(tenant)
      .find({ _id: { $in: validPermissionIds } })
      .select("permission description")
      .lean();

    // logObject("✅ [DEBUG] Successfully populated permissions:", {
    //   requested: validPermissionIds.length,
    //   found: permissions.length,
    // });

    return {
      ...role,
      role_permissions: permissions,
    };
  } catch (error) {
    logger.error(`Error populating role permissions: ${error.message}`);
    // logObject("❌ [DEBUG] Error in manuallyPopulateRolePermissions:", error);
    return { ...role, role_permissions: [] };
  }
};

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
  try {
    logObject("🔍 [DEBUG] findAssociatedIdForRole called with:", {
      role_id,
      tenant,
      rolesCount: roles?.length,
    });

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      logObject("❌ [DEBUG] No roles provided or empty roles array");
      return null;
    }

    if (!role_id) {
      logObject("❌ [DEBUG] No role_id provided");
      return null;
    }

    // Validate role_id format
    if (!mongoose.Types.ObjectId.isValid(role_id)) {
      logObject("❌ [DEBUG] Invalid role_id format:", role_id);
      return null;
    }

    // Find role details with proper error handling
    let RoleDetails;
    try {
      RoleDetails = await RoleModel(tenant).findById(role_id).lean();
    } catch (dbError) {
      logObject("❌ [DEBUG] Database error fetching role:", dbError.message);
      return null;
    }

    if (!RoleDetails) {
      logObject("❌ [DEBUG] Role not found for role_id:", role_id);
      return null;
    }

    logObject("✅ [DEBUG] RoleDetails:", {
      id: RoleDetails._id,
      name: RoleDetails.role_name,
      hasNetworkId: !!RoleDetails.network_id,
      hasGroupId: !!RoleDetails.group_id,
    });

    for (const role of roles) {
      if (!role) {
        logObject("⚠️ [DEBUG] Skipping undefined role in array");
        continue;
      }

      // Enhanced null checks and validation before comparison
      if (role.network && RoleDetails.network_id) {
        try {
          // Validate both IDs before comparison
          if (
            mongoose.Types.ObjectId.isValid(role.network) &&
            mongoose.Types.ObjectId.isValid(RoleDetails.network_id)
          ) {
            const roleNetworkId = role.network.toString();
            const roleDetailsNetworkId = RoleDetails.network_id.toString();

            if (roleNetworkId === roleDetailsNetworkId) {
              logObject("✅ [DEBUG] Found matching network:", role.network);
              return role.network;
            }
          }
        } catch (error) {
          logObject("❌ [DEBUG] Error comparing network IDs:", error.message);
        }
      }

      if (role.group && RoleDetails.group_id) {
        try {
          // Validate both IDs before comparison
          if (
            mongoose.Types.ObjectId.isValid(role.group) &&
            mongoose.Types.ObjectId.isValid(RoleDetails.group_id)
          ) {
            const roleGroupId = role.group.toString();
            const roleDetailsGroupId = RoleDetails.group_id.toString();

            if (roleGroupId === roleDetailsGroupId) {
              logObject("✅ [DEBUG] Found matching group:", role.group);
              return role.group;
            }
          }
        } catch (error) {
          logObject("❌ [DEBUG] Error comparing group IDs:", error.message);
        }
      }
    }

    logObject("❌ [DEBUG] No matching network or group found");
    return null;
  } catch (error) {
    logObject("🐛 [DEBUG] Error in findAssociatedIdForRole:", error);
    logger.error(`Error in findAssociatedIdForRole: ${error.message}`);
    return null;
  }
};
const isAssignedUserSuperAdmin = async ({
  associatedId,
  roles = [],
  tenant = "airqo",
}) => {
  try {
    logObject("🔍 [DEBUG] isAssignedUserSuperAdmin called with:", {
      associatedId,
      tenant,
      rolesCount: roles?.length,
    });

    if (!associatedId) {
      logObject("❌ [DEBUG] No associatedId provided");
      return false;
    }

    // Validate associatedId format
    if (!mongoose.Types.ObjectId.isValid(associatedId)) {
      logObject("❌ [DEBUG] Invalid associatedId format:", associatedId);
      return false;
    }

    if (!roles || !Array.isArray(roles) || roles.length === 0) {
      logObject("❌ [DEBUG] No roles provided or empty roles array");
      return false;
    }

    const associatedIdStr = associatedId.toString();

    for (const role of roles) {
      if (!role) {
        logObject("⚠️ [DEBUG] Skipping undefined role in array");
        continue;
      }

      // Enhanced validation and null checks
      let isMatch = false;

      try {
        if (role.network && mongoose.Types.ObjectId.isValid(role.network)) {
          const roleNetworkStr = role.network.toString();
          if (roleNetworkStr === associatedIdStr) {
            isMatch = true;
          }
        } else if (role.group && mongoose.Types.ObjectId.isValid(role.group)) {
          const roleGroupStr = role.group.toString();
          if (roleGroupStr === associatedIdStr) {
            isMatch = true;
          }
        }
      } catch (error) {
        logObject("❌ [DEBUG] Error comparing role IDs:", error.message);
        continue;
      }

      if (isMatch) {
        logObject("🔍 [DEBUG] Found matching role, checking if super admin...");

        // Enhanced validation for role field
        if (!role.role) {
          logObject("⚠️ [DEBUG] Role has no role field:", role);
          continue;
        }

        // Validate role ID format
        if (!mongoose.Types.ObjectId.isValid(role.role)) {
          logObject("⚠️ [DEBUG] Invalid role ID format:", role.role);
          continue;
        }

        try {
          const RoleDetails = await RoleModel(tenant)
            .findById(role.role)
            .lean();

          if (RoleDetails && RoleDetails.role_name) {
            logObject("📋 [DEBUG] Checking role name:", RoleDetails.role_name);
            if (RoleDetails.role_name.endsWith("SUPER_ADMIN")) {
              logObject("✅ [DEBUG] User is SUPER_ADMIN");
              return true;
            }
          } else {
            logObject("⚠️ [DEBUG] RoleDetails not found or missing role_name");
          }
        } catch (error) {
          logObject("❌ [DEBUG] Error fetching role details:", error.message);
        }
      }
    }

    logObject("✅ [DEBUG] User is not SUPER_ADMIN");
    return false;
  } catch (error) {
    logObject("🐛 [DEBUG] Error in isAssignedUserSuperAdmin:", error);
    logger.error(`Error in isAssignedUserSuperAdmin: ${error.message}`);
    return false;
  }
};
const isRoleAlreadyAssigned = (roles, role_id) => {
  try {
    logObject("🔍 [DEBUG] isRoleAlreadyAssigned called with:", {
      rolesCount: roles?.length,
      role_id,
    });

    if (isEmpty(roles) || !Array.isArray(roles)) {
      logObject("❌ [DEBUG] No roles or invalid roles array");
      return false;
    }

    if (!role_id) {
      logObject("❌ [DEBUG] No role_id provided");
      return false;
    }

    // Validate role_id format
    if (!mongoose.Types.ObjectId.isValid(role_id)) {
      logObject("❌ [DEBUG] Invalid role_id format:", role_id);
      return false;
    }

    const targetRoleIdStr = role_id.toString();

    const isAssigned = roles.some((role) => {
      if (isEmpty(role) || !role.role) {
        return false;
      }

      // Validate role.role format
      if (!mongoose.Types.ObjectId.isValid(role.role)) {
        logObject("⚠️ [DEBUG] Invalid role.role format:", role.role);
        return false;
      }

      try {
        const roleIdStr = role.role.toString();
        logObject("🔍 [DEBUG] Comparing roles:", {
          roleIdStr,
          targetRoleIdStr,
        });
        return roleIdStr === targetRoleIdStr;
      } catch (error) {
        logObject("❌ [DEBUG] Error comparing role IDs:", error.message);
        return false;
      }
    });

    logObject("📋 [DEBUG] Role assignment check result:", isAssigned);
    return isAssigned;
  } catch (error) {
    logObject("🐛 [DEBUG] Error in isRoleAlreadyAssigned:", error);
    logger.error(`Error in isRoleAlreadyAssigned: ${error.message}`);
    return false;
  }
};

const createOrUpdateRoleWithPermissionSync = async (tenant, roleData) => {
  try {
    logObject(`🔍 Processing role with permission sync: ${roleData.role_name}`);

    // Get permission IDs for the role
    const permissions = await PermissionModel(tenant)
      .find({ permission: { $in: roleData.permissions } })
      .select("_id permission")
      .lean();

    const permissionIds = permissions.map((p) => p._id);
    const foundPermissions = permissions.map((p) => p.permission);
    const missingPermissions = roleData.permissions.filter(
      (p) => !foundPermissions.includes(p)
    );

    if (missingPermissions.length > 0) {
      logger.warn(
        `⚠️  Missing permissions for role ${roleData.role_name}: ${stringify(
          missingPermissions
        )}`
      );
    }

    // Check if role already exists
    const existingRole = await RoleModel(tenant)
      .findOne({
        $or: [
          { role_code: roleData.role_code || roleData.role_name },
          { role_name: roleData.role_name },
        ],
      })
      .lean();

    if (existingRole) {
      const currentPermissionIds = (existingRole.role_permissions || []).map(
        (id) => id.toString()
      );
      const expectedPermissionIds = permissionIds.map((id) => id.toString());

      const arePermissionsSynced =
        currentPermissionIds.length === expectedPermissionIds.length &&
        currentPermissionIds.every((id) => expectedPermissionIds.includes(id));

      if (!arePermissionsSynced) {
        logObject(
          `📝 Permissions for role ${roleData.role_name} are out of sync. Updating...`
        );
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
        return {
          success: true,
          data: updatedRole,
          message: `Role ${roleData.role_name} permissions synchronized`,
          action: "updated",
          status: httpStatus.OK,
          role_name: roleData.role_name,
          permissions_synced: expectedPermissionIds.length,
        };
      } else {
        logObject(
          `✅ Role ${roleData.role_name} already has all required permissions`
        );
        return {
          success: true,
          data: existingRole,
          message: `Role ${roleData.role_name} is already up to date`,
          action: "unchanged",
          status: httpStatus.OK,
          role_name: roleData.role_name,
        };
      }
    } else {
      // Create new role
      const newRole = await RoleModel(tenant).create({
        role_name: roleData.role_name,
        role_code: roleData.role_code || roleData.role_name,
        role_description: roleData.role_description,
        group_id: roleData.group_id,
        network_id: roleData.network_id,
        role_permissions: permissionIds,
        role_status: "ACTIVE",
      });

      logObject(`✅ Created new role: ${roleData.role_name}`);
      return {
        success: true,
        data: newRole,
        message: `Role ${roleData.role_name} created successfully`,
        action: "created",
        status: httpStatus.OK,
        role_name: roleData.role_name,
      };
    }
  } catch (err) {
    return {
      success: false,
      message: "Error creating/updating role",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      role_name: roleData.role_name,
      errors: { message: err.message },
    };
  }
};

const syncPermissions = async (tenant, permissionsList) => {
  const createdPermissions = [];
  const updatedPermissions = [];
  const existingPermissions = [];

  for (const permissionData of permissionsList) {
    try {
      const existingPermission = await PermissionModel(tenant)
        .findOne({
          permission: permissionData.permission,
        })
        .lean();

      if (!existingPermission) {
        const newPermission = await PermissionModel(tenant).create(
          permissionData
        );
        createdPermissions.push(newPermission);
        logger.debug(`✅ Created permission: ${permissionData.permission}`);
      } else {
        existingPermissions.push(existingPermission);
        // Update description if it has changed
        if (
          permissionData.description &&
          existingPermission.description !== permissionData.description
        ) {
          const updated = await PermissionModel(tenant).findByIdAndUpdate(
            existingPermission._id,
            { description: permissionData.description },
            { new: true }
          );
          updatedPermissions.push(updated);
          logObject(
            `🔄 Updated permission description for: ${permissionData.permission}`
          );
        }
      }
    } catch (error) {
      // Only log errors that are not duplicate key errors, which are expected.
      if (error.code !== 11000) {
        logger.error(
          `Error syncing permission ${permissionData.permission}: ${error.message}`
        );
      }
    }
  }
  return { createdPermissions, existingPermissions, updatedPermissions };
};

const syncAirqoRoles = async (tenant, rolesList, airqoGroupId) => {
  const roleProcessingPromises = rolesList.map((roleData) => {
    return (async () => {
      try {
        logger.debug(
          `[RBAC Setup] Syncing role: ${roleData.role_name} for group ${airqoGroupId}`
        );
        const data = { ...roleData, group_id: airqoGroupId };
        const result = await createOrUpdateRoleWithPermissionSync(tenant, data);
        if (!result) {
          logger.error(
            `[RBAC Setup] Failed to sync role ${roleData.role_name}. Result was empty.`
          );
          return {
            success: false,
            role_name: roleData.role_name,
            message: "Empty result from sync function",
          };
        }
        return result;
      } catch (error) {
        logger.error(
          `Error creating/updating role ${roleData.role_name}: ${error.message}`
        );
        return {
          success: false,
          role_name: roleData.role_name,
          message: error.message,
        };
      }
    })();
  });

  const roleCreationResults = await Promise.all(roleProcessingPromises);

  let airqoSuperAdminExists = false;
  let airqoSuperAdminRoleId = null;
  let rolesCreated = 0;
  let rolesUpdated = 0;
  let rolesUpToDate = 0;

  for (const result of roleCreationResults) {
    if (result && result.success) {
      switch (result.action) {
        case "updated":
          rolesUpdated++;
          break;
        case "created":
          rolesCreated++;
          break;
        case "unchanged":
          rolesUpToDate++;
          break;
      }

      if (
        result.data &&
        (result.data.role_name === "AIRQO_SUPER_ADMIN" ||
          result.data.role_code === "AIRQO_SUPER_ADMIN")
      ) {
        airqoSuperAdminExists = true;
        airqoSuperAdminRoleId = result.data._id;
      }
    }
  }

  return {
    roleCreationResults,
    airqoSuperAdminExists,
    airqoSuperAdminRoleId,
    stats: { rolesCreated, rolesUpdated, rolesUpToDate },
  };
};

const auditAndSyncExistingRoles = async (tenant) => {
  try {
    logObject("🔍 Auditing and syncing existing organization roles...");

    // Get all existing organization roles (non-AirQo roles) without populate
    const existingRoles = await RoleModel(tenant)
      .find({
        role_name: { $not: { $regex: /^AIRQO_/ } },
      })
      .lean();

    // Use the centralized role definitions from constants
    const rolePermissionTemplates = Object.entries(
      constants.DEFAULT_ROLE_DEFINITIONS
    ).reduce((acc, [key, value]) => {
      // Extract the base role type (e.g., SUPER_ADMIN from AIRQO_SUPER_ADMIN)
      const roleType = key.replace(/^AIRQO_/, "").replace(/^DEFAULT_/, "");
      acc[roleType] = value.permissions;
      return acc;
    }, {});

    // OPTIMIZATION: Fetch all possible permissions once
    const allPermissionNames = Object.values(rolePermissionTemplates).flat();
    const allPermissions = await PermissionModel(tenant)
      .find({ permission: { $in: allPermissionNames } })
      .lean();
    const permissionsMap = new Map(
      allPermissions.map((p) => [p.permission, p._id])
    );

    logObject(`📊 Found ${existingRoles.length} organization roles to audit`);

    // Manually populate permissions for each role
    const rolesWithPermissions = await Promise.all(
      existingRoles.map((role) => manuallyPopulateRolePermissions(role, tenant))
    );

    let rolesUpdated = 0;
    let permissionsAdded = 0;

    for (const role of rolesWithPermissions) {
      try {
        // Determine role type from role name
        // Updated logic: Check both role_name and role_code for a match
        let roleType = null;
        for (const [type, permissions] of Object.entries(
          rolePermissionTemplates
        )) {
          // Check if role_name or role_code ends with the type (e.g., "_ADMIN")
          if (
            (role.role_name && role.role_name.endsWith(`_${type}`)) ||
            (role.role_code && role.role_code.endsWith(`_${type}`))
          ) {
            roleType = type;
            break;
          }
          // Fallback for exact match (e.g., "ADMIN")
          if (role.role_name === type || role.role_code === type) {
            roleType = type;
            break;
          }
        }

        if (!roleType) {
          logObject(`⚠️  Unknown role type for: ${role.role_name}, skipping`);
          continue;
        }

        const expectedPermissions = rolePermissionTemplates[roleType];
        const currentPermissions =
          role.role_permissions?.map((p) => p.permission) || [];
        const missingPermissions = expectedPermissions.filter(
          (p) => !currentPermissions.includes(p)
        );

        if (missingPermissions.length > 0) {
          logObject(
            `📝 Adding ${missingPermissions.length} missing permissions to ${role.role_name}:`,
            missingPermissions
          );

          // Get permission IDs for missing permissions
          const missingPermissionDocs = missingPermissions
            .map((pName) => permissionsMap.get(pName))
            .filter(Boolean); // filter out undefined if a permission is not in the map

          // Use IDs directly from the map
          if (missingPermissionDocs.length > 0) {
            const currentPermissionIds =
              role.role_permissions?.map((p) => p._id) || [];
            const newPermissionIds = missingPermissionDocs; // This is already an array of IDs
            const allPermissionIds = [
              ...currentPermissionIds,
              ...newPermissionIds,
            ];

            await RoleModel(tenant).findByIdAndUpdate(role._id, {
              role_permissions: allPermissionIds,
              updatedAt: new Date(),
            });

            rolesUpdated++;
            permissionsAdded += missingPermissionDocs.length;
            logText(
              `✅ Updated role ${role.role_name} with ${missingPermissionDocs.length} new permissions`
            );
          }
        }
      } catch (error) {
        logger.error(
          `❌ Error processing role ${role.role_name}: ${error.message}`
        );
      }
    }

    logText(
      `🎉 Role audit complete: ${rolesUpdated} roles updated, ${permissionsAdded} permissions added`
    );
    return { rolesUpdated, permissionsAdded };
  } catch (error) {
    logger.error(`❌ Error in auditAndSyncExistingRoles:  ${error.message}`);
    return { rolesUpdated: 0, permissionsAdded: 0 };
  }
};

const updateTenantSettingsWithDefaultRoles = async (tenant) => {
  try {
    const airqoGroup = await getOrCreateAirqoGroup(tenant);
    const defaultRoleCodes = ["AIRQO_DEFAULT_MEMBER", "AIRQO_DEFAULT_USER"];
    const defaultUserRole = await RoleModel(tenant)
      .findOne({ role_code: { $in: defaultRoleCodes } })
      .lean();

    if (defaultUserRole) {
      const settingsUpdate = {
        defaultGroup: airqoGroup._id,
        defaultGroupRole: defaultUserRole._id,
        defaultNetwork: constants.DEFAULT_NETWORK, // Assuming this is static for now
        defaultNetworkRole: defaultUserRole._id,
      };
      await TenantSettingsModel(tenant).findOneAndUpdate(
        { tenant },
        { $set: settingsUpdate },
        { upsert: true, new: true }
      );
      logText("✅ Tenant settings updated with default roles.");
    } else {
      logger.warn("⚠️ Could not find default roles to update tenant settings.");
    }
  } catch (error) {
    logger.error(`Error updating tenant settings: ${error.message}`);
  }
};

/**
 * Setup default permissions and roles for the system
 * Called at application startup
 */
const getGlobalRoles = () => {
  return Object.values(constants.DEFAULT_ROLE_DEFINITIONS)
    .filter(
      (roleDef) =>
        !roleDef.role_name.startsWith("AIRQO_") &&
        !roleDef.group_id &&
        !roleDef.network_id
    )
    .map((roleDef) => ({
      ...roleDef,
    }));
};

const syncGlobalRoles = async (tenant, rolesList) => {
  const roleProcessingPromises = rolesList.map((roleData) => {
    return (async () => {
      try {
        logger.debug(`[RBAC Setup] Syncing global role: ${roleData.role_name}`);
        const result = await createOrUpdateRoleWithPermissionSync(
          tenant,
          roleData
        );
        if (!result) {
          logger.error(
            `[RBAC Setup] Failed to sync global role ${roleData.role_name}. Result was empty.`
          );
          return {
            success: false,
            role_name: roleData.role_name,
            message: "Empty result from sync function",
          };
        }
        return result;
      } catch (error) {
        logger.error(
          `Error creating/updating global role ${roleData.role_name}: ${error.message}`
        );
        return {
          success: false,
          role_name: roleData.role_name,
          message: error.message,
        };
      }
    })();
  });

  const roleCreationResults = await Promise.all(roleProcessingPromises);

  let rolesCreated = 0;
  let rolesUpdated = 0;
  let rolesUpToDate = 0;

  for (const result of roleCreationResults) {
    if (result && result.success) {
      switch (result.action) {
        case "updated":
          rolesUpdated++;
          break;
        case "created":
          rolesCreated++;
          break;
        case "unchanged":
          rolesUpToDate++;
          break;
      }
    }
  }

  return {
    roleCreationResults,
    stats: { rolesCreated, rolesUpdated, rolesUpToDate },
  };
};

const setupDefaultPermissions = async (tenant = "airqo") => {
  try {
    logText(
      `🚀 Setting up default permissions and roles for tenant: ${tenant}`
    );

    // Step 1: Synchronize all permissions
    const allPermissionsList = constants.ALL.map((p) => ({
      permission: p,
      description: p.replace(/_/g, " ").toLowerCase(),
    }));
    const permissionSyncResult = await syncPermissions(
      tenant,
      allPermissionsList
    );

    // Step 2: Ensure AirQo group exists
    const airqoGroup = await getOrCreateAirqoGroup(tenant);

    // Step 3: Synchronize core AirQo system roles
    const defaultAirqoRoles = getDefaultAirqoRoles(airqoGroup._id);
    const airqoRoleSyncResult = await syncAirqoRoles(
      tenant,
      defaultAirqoRoles,
      airqoGroup._id
    );

    // Step 3.5: Synchronize global roles (like SYSTEM_ADMIN)
    const globalRoles = getGlobalRoles();
    const globalRoleSyncResult = await syncGlobalRoles(tenant, globalRoles);

    // Step 4: Audit and sync permissions for existing non-system roles
    const auditStats = await auditAndSyncExistingRoles(tenant);

    // Step 5: Update tenant settings with default roles
    await updateTenantSettingsWithDefaultRoles(tenant);

    logText("🎉 Default permissions and roles setup completed successfully!");

    // Step 6: Consolidate and return results
    return {
      success: true,
      message: "Default permissions and roles setup completed successfully",
      data: {
        permissions: {
          created: permissionSyncResult.createdPermissions.length,
          updated: permissionSyncResult.updatedPermissions.length,
          existing: permissionSyncResult.existingPermissions.length,
          total: allPermissionsList.length,
        },
        airqo_roles: {
          created: airqoRoleSyncResult.stats.rolesCreated,
          updated: airqoRoleSyncResult.stats.rolesUpdated,
          up_to_date: airqoRoleSyncResult.stats.rolesUpToDate,
          processed: defaultAirqoRoles.length,
          successful: airqoRoleSyncResult.roleCreationResults.filter(
            (r) => r.success
          ).length,
          failed: airqoRoleSyncResult.roleCreationResults.filter(
            (r) => !r.success
          ).length,
        },
        global_roles: {
          created: globalRoleSyncResult.stats.rolesCreated,
          updated: globalRoleSyncResult.stats.rolesUpdated,
          up_to_date: globalRoleSyncResult.stats.rolesUpToDate,
          processed: globalRoles.length,
          successful: globalRoleSyncResult.roleCreationResults.filter(
            (r) => r.success
          ).length,
          failed: globalRoleSyncResult.roleCreationResults.filter(
            (r) => !r.success
          ).length,
        },
        audit: {
          organization_roles_audited: auditStats.rolesUpdated,
          permissions_added_to_roles: auditStats.permissionsAdded,
        },
        airqo_super_admin_exists: airqoRoleSyncResult.airqoSuperAdminExists,
        airqo_super_admin_role_id: airqoRoleSyncResult.airqoSuperAdminRoleId,
        role_errors: [
          ...airqoRoleSyncResult.roleCreationResults
            .filter((r) => !r.success)
            .map((r) => ({
              role_name: r.role_name || "unknown",
              error: r.message || "unknown error",
            })),
          ...globalRoleSyncResult.roleCreationResults
            .filter((r) => !r.success)
            .map((r) => ({
              role_name: r.role_name || "unknown",
              error: r.message || "unknown error",
            })),
        ],
      },
    };
  } catch (error) {
    logger.error(`❌ Error setting up default permissions: ${error.message}`);
    throw error;
  }
};

/**
 * Helper function to create or update a role with E11000 duplicate handling
 * Inspired by the register function pattern
 */
const createOrUpdateRole = async (tenant, roleData) => {
  try {
    logObject(`🔍 Processing role: ${roleData.role_name}`);

    // Get permission IDs for the role
    const permissions = await PermissionModel(tenant)
      .find({ permission: { $in: roleData.permissions } })
      .select("_id")
      .lean();

    const permissionIds = permissions.map((p) => p._id);

    // Try to create the role directly
    const newRole = await RoleModel(tenant).create({
      role_name: roleData.role_name,
      role_code: generateRoleCode(roleData.role_name, "", roleData.role_code),
      role_description: roleData.role_description,
      group_id: roleData.group_id,
      network_id: roleData.network_id,
      role_permissions: permissionIds,
      role_status: "ACTIVE",
    });

    logObject(`✅ Created new role: ${roleData.role_name}`);
    return {
      success: true,
      data: newRole,
      message: `Role ${roleData.role_name} created successfully`,
      status: httpStatus.OK,
      role_name: roleData.role_name, // Add for better tracking
    };
  } catch (err) {
    logObject(`⚠️  Error creating role ${roleData.role_name}:`, err.message);

    // Handle E11000 duplicate key error specifically
    if (err.code === 11000) {
      logObject(
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
            logObject(
              `✅ Found existing role: ${existingRole.role_name} (ID: ${existingRole._id})`
            );
            break;
          }
        }

        if (existingRole) {
          // Update permissions on existing role if needed
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

            logObject(`🔄 Updated existing role: ${roleData.role_name}`);

            return {
              success: true,
              data: updatedRole || existingRole,
              message: `Role ${roleData.role_name} already exists and was updated`,
              status: httpStatus.OK,
              role_name: roleData.role_name,
            };
          } catch (updateError) {
            logObject(
              `⚠️  Update failed, using existing role: ${roleData.role_name}`
            );
            return {
              success: true,
              data: existingRole,
              message: `Role ${roleData.role_name} already exists`,
              status: httpStatus.OK,
              role_name: roleData.role_name,
            };
          }
        } else {
          // Could not find existing role even though duplicate error occurred
          logObject(
            `❌ Duplicate error but role not found: ${roleData.role_name}`
          );

          return {
            success: false,
            message:
              "Duplicate role detected but could not locate existing role",
            status: httpStatus.CONFLICT,
            role_name: roleData.role_name,
            errors: {
              message: `Role with name '${roleData.role_name}' appears to be duplicate but could not be located`,
              suggestion:
                "Try using a different role name or check database consistency",
            },
          };
        }
      } catch (findError) {
        logger.error(
          `❌ Error finding existing role ${roleData.role_name}: ${findError.message}`
        );
        return {
          success: false,
          message: "Duplicate role error and failed to find existing role",
          status: httpStatus.CONFLICT,
          role_name: roleData.role_name,
          errors: {
            message: `Role ${roleData.role_name} appears to be duplicate but could not be located`,
            original_error: err.message,
            search_error: findError.message,
          },
        };
      }
    } else {
      // Handle other errors
      logger.error(
        `❌ Error creating role ${roleData.role_name}: ${err.message}`
      );

      return {
        success: false,
        message: "Error creating role",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        role_name: roleData.role_name,
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

    // Use the new centralized definitions
    const roleTemplates = [
      {
        ...constants.DEFAULT_ROLE_DEFINITIONS.AIRQO_SUPER_ADMIN,
        role_name: `${orgName}_SUPER_ADMIN`,
        role_description: `Super Administrator for ${organizationName}`,
      },
      {
        ...constants.DEFAULT_ROLE_DEFINITIONS.AIRQO_ADMIN,
        role_name: `${orgName}_ADMIN`,
        role_description: `Administrator for ${organizationName}`,
      },
      {
        ...constants.DEFAULT_ROLE_DEFINITIONS.DEFAULT_MEMBER,
        role_name: `${orgName}_DEFAULT_MEMBER`,
        role_description: `Default Member role for ${organizationName}`,
      },
    ];

    const createdRoles = [];
    const roleErrors = [];

    for (const roleTemplate of roleTemplates) {
      try {
        const roleData = {
          ...roleTemplate,
          group_id: groupId,
          role_code: generateRoleCode(roleTemplate.role_name),
        };

        const result = await createOrUpdateRoleWithPermissionSync(
          tenant,
          roleData
        );

        if (result.success) {
          createdRoles.push(result.data);
          logObject(
            `✅ Created/Synced role for ${organizationName}: ${roleTemplate.role_name}`
          );
        } else {
          roleErrors.push({
            role_name: roleTemplate.role_name,
            error: result.message,
            details: result.errors,
          });
          logger.error(
            `❌ Failed to create/sync role ${roleTemplate.role_name}: ${result.message}`
          );
        }
      } catch (error) {
        roleErrors.push({
          role_name: roleTemplate.role_name,
          error: error.message,
          type: "unexpected_error",
        });
        logger.error(
          `❌ Error creating/syncing role ${roleTemplate.role_name}: ${error.message}`
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
    logger.error(
      `❌ Error creating default roles for organization ${organizationName}: ${error.message}`
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

    logObject(
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
      logObject(
        `${dryRun ? "[DRY RUN]" : ""} Updated ${results.users_updated} users`
      );
    }

    if (resetRoles) {
      const deleteResult = await RoleModel(tenant).deleteMany({}, { dryRun });
      results.roles_deleted = deleteResult.deletedCount || 0;
      logObject(
        `${dryRun ? "[DRY RUN]" : ""} Deleted ${results.roles_deleted} roles`
      );
    }

    if (resetPermissions) {
      const deleteResult = await PermissionModel(tenant).deleteMany(
        {},
        { dryRun }
      );
      results.permissions_deleted = deleteResult.deletedCount || 0;
      logObject(
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
    logger.error(`❌ Error resetting RBAC data: ${error.message}`);
    throw error;
  }
};

/**
 * Ensure AIRQO_SUPER_ADMIN role exists (fallback utility)
 * Uses E11000 duplicate handling pattern
 */
const ensureSuperAdminRole = async (tenant = "airqo") => {
  try {
    logObject("🔍 Ensuring AIRQO_SUPER_ADMIN role exists...");

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
      logObject(
        `✅ Found existing AIRQO_SUPER_ADMIN role (ID: ${superAdminRole._id})`
      );
      return superAdminRole;
    }

    logObject("🆕 AIRQO_SUPER_ADMIN role not found, creating...");

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
      logObject("✅ Created AirQo organization");
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
      logObject("⚠️  No permissions found, creating minimal set...");

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
          logObject(`✅ Created permission: ${permData.permission}`);
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

      logObject(
        `✅ Created AIRQO_SUPER_ADMIN role (ID: ${superAdminRole._id})`
      );
      return superAdminRole;
    } catch (err) {
      logObject(`⚠️  Error creating super admin role:`, err.message);

      // Handle E11000 duplicate key error
      if (err.code === 11000) {
        logObject("🔄 Duplicate detected, searching for existing role...");

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
          logObject(
            `✅ Found existing role after duplicate error (ID: ${superAdminRole._id})`
          );
          return superAdminRole;
        } else {
          logger.error(
            "❌ Duplicate error but could not find existing AIRQO_SUPER_ADMIN role"
          );
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
    logger.error(`❌ Error ensuring AIRQO_SUPER_ADMIN role: ${error.message}`);
    throw error;
  }
};

const getDetailedUserRolesAndPermissions = async (
  userId,
  tenant,
  filters = {}
) => {
  // Get user data without populate to avoid schema registration issues
  const user = await UserModel(tenant).findById(userId).lean();

  if (!user) {
    return null;
  }

  // Extract filter parameters
  const { group_id, network_id, include_all_groups = false } = filters;

  // Manually fetch and organize group-based roles and permissions
  const groupRolesWithPermissions = [];

  // Filter group_roles based on group_id if provided
  let filteredGroupRoles = user.group_roles || [];
  if (group_id && !include_all_groups) {
    filteredGroupRoles = filteredGroupRoles.filter(
      (groupRole) =>
        groupRole.group && groupRole.group.toString() === group_id.toString()
    );
  }

  for (const groupRole of filteredGroupRoles) {
    try {
      // Fetch group details
      const group = groupRole.group
        ? await GroupModel(tenant)
            .findById(groupRole.group)
            .select(
              "_id grp_title grp_description organization_slug grp_status"
            )
            .lean()
        : null;

      // Fetch role details without populate first
      let role = null;
      let permissions = [];

      if (groupRole.role) {
        try {
          role = await RoleModel(tenant).findById(groupRole.role).lean();
          if (role) {
            // Manually populate permissions
            const populatedRole = await manuallyPopulateRolePermissions(
              role,
              tenant
            );
            role = populatedRole;
            permissions = (role.role_permissions || []).map(
              (perm) => perm.permission
            );
          }
        } catch (roleError) {
          logger.error(`Error fetching role: ${roleError.message}`);
        }
      }

      groupRolesWithPermissions.push({
        group: group
          ? {
              _id: group._id,
              name: group.grp_title,
              description: group.grp_description,
              organization_slug: group.organization_slug,
              status: group.grp_status,
            }
          : {
              _id: groupRole.group,
              name: "Unknown Group",
              description: null,
              organization_slug: null,
              status: "unknown",
            },
        role: role
          ? {
              _id: role._id,
              name: role.role_name,
              code: role.role_code,
              description: role.role_description,
            }
          : {
              _id: groupRole.role,
              name: "Unknown Role",
              code: null,
              description: null,
            },
        permissions: permissions,
        permissions_count: permissions.length,
        user_type: groupRole.userType,
        assigned_at: groupRole.createdAt,
      });
    } catch (error) {
      logger.error(`Error processing group role: ${error.message}`);
      continue;
    }
  }

  // Similar logic for network roles with network_id filter
  const networkRolesWithPermissions = [];

  // Filter network_roles based on network_id if provided
  let filteredNetworkRoles = user.network_roles || [];
  if (network_id) {
    filteredNetworkRoles = filteredNetworkRoles.filter(
      (networkRole) =>
        networkRole.network &&
        networkRole.network.toString() === network_id.toString()
    );
  }

  for (const networkRole of filteredNetworkRoles) {
    try {
      // For networks, we'll handle gracefully since NetworkModel might not exist
      let network = null;
      if (networkRole.network) {
        try {
          // Try to get network details if available
          network = {
            _id: networkRole.network,
            name: "Network", // Placeholder
            description: null,
            status: "active",
          };
        } catch (networkError) {
          logger.warn(
            `Could not fetch network details: ${networkError.message}`
          );
        }
      }

      // Fetch role details without populate first
      let role = null;
      let permissions = [];

      if (networkRole.role) {
        try {
          role = await RoleModel(tenant).findById(networkRole.role).lean();
          if (role) {
            // Manually populate permissions
            const populatedRole = await manuallyPopulateRolePermissions(
              role,
              tenant
            );
            role = populatedRole;
            permissions = (role.role_permissions || []).map(
              (perm) => perm.permission
            );
          }
        } catch (roleError) {
          logger.error(`Error fetching network role: ${roleError.message}`);
        }
      }

      networkRolesWithPermissions.push({
        network: network || {
          _id: networkRole.network,
          name: "Unknown Network",
          description: null,
          status: "unknown",
        },
        role: role
          ? {
              _id: role._id,
              name: role.role_name,
              code: role.role_code,
              description: role.role_description,
            }
          : {
              _id: networkRole.role,
              name: "Unknown Role",
              code: null,
              description: null,
            },
        permissions: permissions,
        permissions_count: permissions.length,
        user_type: networkRole.userType,
        assigned_at: networkRole.createdAt,
      });
    } catch (error) {
      logger.error(`Error processing network role: ${error.message}`);
      continue;
    }
  }

  // Calculate summary statistics
  const allPermissions = new Set();
  groupRolesWithPermissions.forEach((groupRole) => {
    groupRole.permissions.forEach((permission) =>
      allPermissions.add(permission)
    );
  });
  networkRolesWithPermissions.forEach((networkRole) => {
    networkRole.permissions.forEach((permission) =>
      allPermissions.add(permission)
    );
  });

  const summary = {
    total_groups: groupRolesWithPermissions.length,
    total_networks: networkRolesWithPermissions.length,
    total_unique_permissions: allPermissions.size,
    all_permissions: Array.from(allPermissions).sort(),
    has_super_admin_role: [
      ...groupRolesWithPermissions,
      ...networkRolesWithPermissions,
    ].some((item) => item.role.name && item.role.name.includes("SUPER_ADMIN")),
    // Add filter metadata
    filters_applied: {
      group_id: group_id || null,
      network_id: network_id || null,
      include_all_groups,
    },
  };

  return {
    user: {
      _id: user._id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      full_name: `${user.firstName} ${user.lastName}`,
      is_active: user.isActive,
      verified: user.verified,
    },
    group_roles: groupRolesWithPermissions,
    network_roles: networkRolesWithPermissions,
    summary: summary,
  };
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
        return;
      }

      const roleResponse = await RoleModel(tenant).aggregate([
        {
          $match: {
            group_id: mongoose.Types.ObjectId(grp_id),
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
      } else {
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
      let queryFilter = {};

      if (body.group_id) {
        const group = await GroupModel(tenant).findById(body.group_id);
        if (isEmpty(group)) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided group ${body.group_id} is invalid, please crosscheck`,
            })
          );
        }
        organizationName = normalizeName(group.grp_title);
        queryFilter = { group_id: body.group_id };
      } else if (body.network_id) {
        const NetworkModel = require("@models/Network");
        const network = await NetworkModel(tenant).findById(body.network_id);
        if (isEmpty(network)) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Provided network ${body.network_id} is invalid, please crosscheck`,
            })
          );
        }
        organizationName = normalizeName(network.net_name);
        queryFilter = { network_id: body.network_id };
      } else {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Either network_id or group_id must be provided",
          })
        );
      }

      const transformedRoleName = convertToUpperCaseWithUnderscore(
        body.role_name
      );
      const finalRoleName = `${organizationName}_${transformedRoleName}`;

      // PRE-VALIDATION: Check if role_name already exists
      const existingRoleByName = await RoleModel(tenant)
        .findOne({
          role_name: finalRoleName,
          ...queryFilter,
        })
        .lean();

      if (existingRoleByName) {
        return next(
          new HttpError("Role Name Conflict", httpStatus.CONFLICT, {
            message: `Role with name "${finalRoleName}" already exists`,
            conflicting_role: {
              id: existingRoleByName._id,
              name: existingRoleByName.role_name,
              code: existingRoleByName.role_code,
            },
            suggestions: [
              `${finalRoleName}_V2`,
              `${finalRoleName}_NEW`,
              `${finalRoleName}_${Date.now().toString().slice(-4)}`,
            ],
            error_type: "role_name_duplicate",
          })
        );
      }

      // Generate and validate role_code
      const baseRoleCode = generateRoleCode(
        body.role_name,
        organizationName,
        body.role_code
      );
      const roleCodeCheck = await findAvailableRoleCode(
        tenant,
        baseRoleCode,
        queryFilter
      );

      if (!roleCodeCheck.available) {
        if (roleCodeCheck.error) {
          return next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              {
                message: roleCodeCheck.error,
              }
            )
          );
        }

        if (body.role_code) {
          return next(
            new HttpError("Role Code Conflict", httpStatus.CONFLICT, {
              message: `Role code "${baseRoleCode}" already exists`,
              conflicting_role: roleCodeCheck.existingRole,
              suggestions: roleCodeCheck.suggestions,
              error_type: "explicit_role_code_conflict",
            })
          );
        }

        if (roleCodeCheck.suggestions.length > 0) {
          newBody.role_code = roleCodeCheck.suggestions[0];
          logObject(`Using alternative role code: ${newBody.role_code}`);
        } else {
          return next(
            new HttpError("Role Code Conflict", httpStatus.CONFLICT, {
              message: `Cannot generate unique role code for "${body.role_name}"`,
              conflicting_role: roleCodeCheck.existingRole,
              error_type: "auto_generation_failed",
              suggestion:
                "Please provide a custom role_code or try a different role_name",
            })
          );
        }
      } else {
        newBody.role_code = roleCodeCheck.roleCode;
      }

      newBody.role_name = finalRoleName;

      // IMPORTANT: Ensure network_id is not set if we're using group_id
      if (body.group_id && !body.network_id) {
        newBody.network_id = undefined;
        delete newBody.network_id;
      }

      const responseFromCreateRole = await RoleModel(
        tenant.toLowerCase()
      ).register(newBody, next);

      if (responseFromCreateRole.success && responseFromCreateRole.data) {
        responseFromCreateRole.role_code_info = {
          requested_name: body.role_name,
          final_role_name: finalRoleName,
          generated_code: newBody.role_code,
          was_auto_generated: !body.role_code,
          organization: organizationName,
        };
      }

      return responseFromCreateRole;
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
      const { tenant, user, user_type } = { ...request.body, ...request.query };
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

      // Get user without populate, then manually check roles
      const userObject = await UserModel(tenant).findById(userId).lean();

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

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userObject._id },
        {
          $pull: {
            [isNetworkRole ? "network_roles" : "group_roles"]: {
              [isNetworkRole ? "network" : "group"]: associatedId,
            },
          },
          $addToSet: {
            [isNetworkRole ? "network_roles" : "group_roles"]: {
              ...(isNetworkRole
                ? { network: associatedId }
                : { group: associatedId }),
              role: role_id,
              userType: user_type || "guest",
              createdAt: new Date(),
            },
          },
        },
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

      // Get users without populate
      const users = await UserModel(tenant)
        .find({ _id: { $in: user_ids } })
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

        await UserModel(tenant).updateOne(
          { _id: user._id },
          {
            $pull: {
              [isNetworkRole ? "network_roles" : "group_roles"]: {
                [isNetworkRole ? "network" : "group"]: associatedId,
              },
            },
            $addToSet: {
              [isNetworkRole ? "network_roles" : "group_roles"]: {
                [isNetworkRole ? "network" : "group"]: associatedId,
                role: role_id,
                userType: (body && body.user_type) || "guest",
                createdAt: new Date(),
              },
            },
          }
        );

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

      // Get user and role data without populate
      const [userObject, role, userExists, roleExists] = await Promise.all([
        UserModel(tenant).findById(user_id).lean(),
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
        // Get user without populate
        const userObject = await UserModel(tenant).findById(user_id).lean();

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
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Role ${role_id.toString()} Not Found`,
          })
        );
      }

      if (!Array.isArray(permissions) || permissions.length === 0) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "permissions must be a non-empty array of ObjectId strings",
          })
        );
      }

      // Validate that all provided permission IDs are valid before querying the database.
      const validPermissionIds = [];
      const invalidPermissionIds = [];
      for (const id of permissions) {
        if (mongoose.Types.ObjectId.isValid(id)) {
          validPermissionIds.push(ObjectId(id));
        } else {
          invalidPermissionIds.push(id);
        }
      }

      if (invalidPermissionIds.length > 0) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid permission IDs provided: ${invalidPermissionIds.join(
              ", "
            )}`,
          })
        );
      }

      const permissionsResponse = await PermissionModel(tenant).find(
        {
          _id: { $in: validPermissionIds },
        },
        "_id"
      );

      const foundIds = new Set(
        permissionsResponse.map((p) => p._id.toString())
      );
      const requestedIds = new Set(
        validPermissionIds.map((id) => id.toString())
      );
      const missingFromDb = [...requestedIds].filter((id) => !foundIds.has(id));
      if (missingFromDb.length > 0) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Not all provided permissions exist. Missing: ${missingFromDb.join(
              ", "
            )}`,
          })
        );
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      const toAddIds = validPermissionIds.filter(
        (id) => !assignedPermissions.includes(id.toString())
      );
      const skipped = validPermissionIds.filter((id) =>
        assignedPermissions.includes(id.toString())
      );

      let updatedRole = role;
      if (toAddIds.length > 0) {
        updatedRole = await RoleModel(tenant).findOneAndUpdate(
          { _id: role_id },
          { $addToSet: { role_permissions: { $each: toAddIds } } },
          { new: true }
        );
      }

      if (isEmpty(updatedRole)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "unable to update Role",
          })
        );
      }
      return {
        success: true,
        message:
          toAddIds.length === 0
            ? "No changes: all provided permissions were already assigned"
            : `Permissions added successfully (${toAddIds.length} added${
                skipped.length ? `, ${skipped.length} skipped` : ""
              })`,
        status: httpStatus.OK,
        data: updatedRole,
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

  getDefaultGroupRole: async (tenant, groupId) => {
    try {
      logObject("🔍 [DEBUG] getDefaultGroupRole called with:", {
        tenant,
        groupId,
      });

      // Validate inputs
      if (!groupId) {
        logger.error("❌ [DEBUG] Group ID is required");
        return null;
      }

      if (!tenant) {
        logger.error("❌ [DEBUG] Tenant is required");
        return null;
      }

      // Validate groupId format
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        logger.error(`❌ [DEBUG] Invalid groupId format: ${groupId}`);
        return null;
      }

      // Safely convert groupId to ObjectId
      let groupObjectId;
      try {
        groupObjectId = mongoose.Types.ObjectId(groupId);
      } catch (objectIdError) {
        logger.error(
          `❌ [DEBUG] Error creating ObjectId from groupId: ${groupId}`
        );
        return null;
      }

      // Find the group with enhanced error handling
      let group;
      try {
        group = await GroupModel(tenant).findById(groupObjectId).lean();
      } catch (dbError) {
        logger.error(
          "❌ [DEBUG] Database error fetching group:",
          dbError.message
        );
        return null;
      }

      if (!group) {
        logger.error("❌ [DEBUG] Group not found for ID:", groupId);
        return null;
      }

      logObject("✅ [DEBUG] Group found:", {
        id: group._id,
        title: group.grp_title,
      });

      // Safely handle group title with fallback
      const groupTitle = group.grp_title || "DEFAULT_GROUP";

      // Sanitize organization name for role code with better validation
      let organizationName;
      try {
        organizationName = groupTitle
          .toString()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "")
          .substring(0, 50);
      } catch (sanitizeError) {
        logObject(
          "⚠️ [DEBUG] Error sanitizing group title:",
          sanitizeError.message
        );
        organizationName = "DEFAULT_GROUP";
      }

      // Ensure we have a valid organization name
      const finalOrgName = organizationName || "DEFAULT";
      const defaultRoleCode = `${finalOrgName}_DEFAULT_MEMBER`;

      logObject("🔍 [DEBUG] Looking for role with code:", defaultRoleCode);

      // Try to find existing default role with enhanced error handling
      let role;
      try {
        role = await RoleModel(tenant)
          .findOne({
            role_code: defaultRoleCode,
            group_id: groupObjectId,
          })
          .lean();
      } catch (findError) {
        logger.error(
          "❌ [DEBUG] Error finding existing role:",
          findError.message
        );
      }

      if (role) {
        logObject("✅ [DEBUG] Found existing default role:", {
          id: role._id,
          name: role.role_name,
          code: role.role_code,
        });
        return role;
      }

      logObject("🆕 [DEBUG] Default role not found, creating new one...");

      // Create new default role with enhanced error handling
      const roleDocument = {
        role_code: defaultRoleCode,
        role_name: defaultRoleCode,
        role_description: `Default role for new group members in ${groupTitle}`,
        group_id: groupObjectId,
        role_status: "ACTIVE",
        role_permissions: [], // Initialize empty, will be populated below
      };

      try {
        // Create the role
        const createResult = await RoleModel(tenant).create(roleDocument);
        role = createResult;

        logObject("✅ [DEBUG] Created new default role:", {
          id: role._id,
          name: role.role_name,
          code: role.role_code,
        });
      } catch (roleCreateError) {
        logObject("⚠️ [DEBUG] Role creation error:", roleCreateError.message);

        // Handle duplicate role creation (race condition)
        if (roleCreateError.code === 11000) {
          logObject(
            "🔄 [DEBUG] Duplicate role detected, searching for existing..."
          );

          // Try to find the role that was created by another process
          try {
            role = await RoleModel(tenant)
              .findOne({
                role_code: defaultRoleCode,
                group_id: groupObjectId,
              })
              .lean();
          } catch (findRetryError) {
            logger.error(
              "❌ [DEBUG] Error in retry search:",
              findRetryError.message
            );
          }

          if (role) {
            logObject("✅ [DEBUG] Found role created by another process:", {
              id: role._id,
              name: role.role_name,
            });
          } else {
            // Last resort - try to find any role with similar code
            try {
              role = await RoleModel(tenant)
                .findOne({
                  role_code: { $regex: new RegExp(finalOrgName, "i") },
                  group_id: groupObjectId,
                  role_name: { $regex: /DEFAULT_MEMBER/i },
                })
                .lean();
            } catch (lastResortError) {
              logger.error(
                "❌ [DEBUG] Last resort search failed:",
                lastResortError.message
              );
            }

            if (!role) {
              const errorMsg = `Failed to create or find default role after duplicate error: ${roleCreateError.message}`;
              logger.error(`❌ [DEBUG] ${errorMsg}`);
              throw new Error(
                `Failed to create default role for group ${groupId}: ${roleCreateError.message}`
              );
            }
          }
        } else {
          // Some other error occurred during role creation
          logger.error(
            `❌ [DEBUG] Unexpected error creating role: ${roleCreateError.message}`
          );
          throw new Error(
            `Failed to create default role: ${roleCreateError.message}`
          );
        }
      }

      // At this point, we should have a role (either newly created or found)
      if (!role) {
        const errorMsg = "No role available after creation/search process";
        logger.error(`❌ [DEBUG] ${errorMsg}`);
        throw new Error("Failed to obtain default role for group");
      }

      // Assign default permissions to the role with enhanced error handling
      try {
        logObject("🔧 [DEBUG] Assigning default permissions to role...");

        // Define default permissions for group members
        const defaultPermissionNames = constants.DEFAULT_MEMBER_PERMISSIONS;

        logObject(
          "📋 [DEBUG] Default permission names:",
          defaultPermissionNames
        );

        if (defaultPermissionNames.length > 0) {
          // Check which permissions actually exist in the database
          let existingPermissions = [];
          try {
            existingPermissions = await PermissionModel(tenant)
              .find({ permission: { $in: defaultPermissionNames } })
              .select("_id permission")
              .lean();
          } catch (permFindError) {
            logger.error(
              "❌ [DEBUG] Error finding existing permissions:",
              permFindError.message
            );
          }

          logObject("📋 [DEBUG] Found existing permissions:", {
            count: existingPermissions.length,
            permissions: existingPermissions.map((p) => p.permission),
          });

          const foundPermissionNames = existingPermissions.map(
            (p) => p.permission
          );
          const missingPermissions = defaultPermissionNames.filter(
            (perm) => !foundPermissionNames.includes(perm)
          );

          if (missingPermissions.length > 0) {
            logObject("⚠️ [DEBUG] Missing permissions:", missingPermissions);

            // Try to create missing permissions with enhanced error handling
            const permissionsToCreate = missingPermissions.map(
              (permission) => ({
                permission: permission,
                description: `Auto-created permission: ${permission}`,
                group_id: groupObjectId,
              })
            );

            try {
              const createdPermissions = await PermissionModel(
                tenant
              ).insertMany(permissionsToCreate, { ordered: false });

              logObject("✅ [DEBUG] Created missing permissions:", {
                count: createdPermissions.length,
              });

              // Add the newly created permissions to our list
              existingPermissions.push(...createdPermissions);
            } catch (createPermError) {
              // Log but don't fail - some permissions might have been created by another process
              logObject(
                "⚠️ [DEBUG] Error creating some permissions:",
                createPermError.message
              );

              // Re-fetch to get any permissions that were created
              try {
                const refetchedPermissions = await PermissionModel(tenant)
                  .find({ permission: { $in: defaultPermissionNames } })
                  .select("_id permission")
                  .lean();

                // Use the refetched permissions
                existingPermissions.length = 0;
                existingPermissions.push(...refetchedPermissions);
              } catch (refetchError) {
                logger.error(
                  "❌ [DEBUG] Error refetching permissions:",
                  refetchError.message
                );
              }
            }
          }

          // Assign permissions to the role if we have any
          if (existingPermissions.length > 0) {
            const permissionIds = existingPermissions.map((p) => p._id);

            logObject("🔧 [DEBUG] Assigning permissions to role:", {
              roleId: role._id,
              permissionCount: permissionIds.length,
            });

            try {
              const updateResult = await RoleModel(tenant).findByIdAndUpdate(
                role._id,
                {
                  $addToSet: {
                    role_permissions: {
                      $each: permissionIds,
                    },
                  },
                },
                { new: true }
              );

              if (updateResult) {
                logObject(
                  "✅ [DEBUG] Successfully assigned permissions to role"
                );
                // Update our role object with the new permissions
                role = updateResult;
              } else {
                logObject("⚠️ [DEBUG] Role update returned null");
              }
            } catch (updateError) {
              logger.error(
                "❌ [DEBUG] Error updating role with permissions:",
                updateError.message
              );
            }
          } else {
            logObject("⚠️ [DEBUG] No permissions available to assign to role");
          }
        } else {
          logObject("⚠️ [DEBUG] No default permissions configured");
        }
      } catch (permissionError) {
        // Log the error but don't fail the entire operation
        logger.warn(
          `⚠️ [DEBUG] Could not assign permissions to default role: ${permissionError.message}`
        );
        logObject("⚠️ [DEBUG] Permission assignment error details:", {
          error: permissionError.message,
          roleId: role._id,
          stack: permissionError.stack,
        });

        // Continue anyway - role exists even without permissions
        // The role can be used and permissions can be assigned later
      }

      // Return the role (with or without permissions)
      logObject("✅ [DEBUG] Returning default group role:", {
        id: role._id,
        name: role.role_name,
        code: role.role_code,
        hasPermissions: !!(
          role.role_permissions && role.role_permissions.length > 0
        ),
      });

      return role;
    } catch (error) {
      logObject("🐛 [DEBUG] Error in getDefaultGroupRole:", {
        error: error.message,
        stack: error.stack,
        groupId,
        tenant,
      });

      logger.error(
        `❌ [DEBUG] Error getting default group role: ${error.message}`
      );

      // Re-throw as HttpError for consistent error handling
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: `Failed to get default group role: ${error.message}`,
          groupId,
          tenant,
        }
      );
    }
  },

  getDefaultNetworkRole: async (tenant, networkId) => {
    try {
      const NetworkModel = require("@models/Network");
      const network = await NetworkModel(tenant).findById(networkId).lean();

      if (!network) {
        return null;
      }

      const organizationName = network.net_name.toUpperCase();
      const defaultRoleCode = `${organizationName}_DEFAULT_MEMBER`;

      let role = await RoleModel(tenant).findOne({
        role_code: defaultRoleCode,
      });

      if (!role) {
        const roleDocument = {
          role_code: defaultRoleCode,
          role_name: defaultRoleCode,
          role_description: "Default role for new network members",
          network_id: networkId,
        };
        role = await RoleModel(tenant).create(roleDocument);

        // Assign default permissions
        const defaultPermissions = await PermissionModel(tenant).find({
          permission: { $in: constants.DEFAULT_NETWORK_MEMBER_PERMISSIONS },
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
      logger.error("Error getting default network role:", error);
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
      logObject("🔍 [DEBUG] getUserRoleSummary called with:", {
        userId,
        tenant,
      });

      // Validate inputs
      if (!userId) {
        logObject("❌ [DEBUG] No userId provided");
        return null;
      }

      if (!tenant) {
        logObject("❌ [DEBUG] No tenant provided");
        return null;
      }

      // Validate userId format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        logObject("❌ [DEBUG] Invalid userId format:", userId);
        return null;
      }

      // Get user with enhanced error handling
      let user;
      try {
        user = await UserModel(tenant).findById(userId).lean();
      } catch (dbError) {
        logObject("❌ [DEBUG] Database error fetching user:", dbError.message);
        return null;
      }

      if (!user) {
        logObject("❌ [DEBUG] User not found with ID:", userId);
        return null;
      }

      logObject("✅ [DEBUG] User found:", {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        hasNetworkRoles: !!(
          user.network_roles && user.network_roles.length > 0
        ),
        hasGroupRoles: !!(user.group_roles && user.group_roles.length > 0),
        networkRolesCount: user.network_roles?.length || 0,
        groupRolesCount: user.group_roles?.length || 0,
      });

      // Build roles with enhanced validation
      const networkRoles = (user.network_roles || [])
        .filter((nr) => nr && typeof nr === "object") // Filter out invalid entries
        .map((nr) => ({
          role_id:
            nr.role && mongoose.Types.ObjectId.isValid(nr.role)
              ? nr.role
              : null,
          network_id:
            nr.network && mongoose.Types.ObjectId.isValid(nr.network)
              ? nr.network
              : null,
          userType: nr.userType,
          createdAt: nr.createdAt,
        }))
        .filter((nr) => nr.role_id && nr.network_id); // Only include valid entries

      const groupRoles = (user.group_roles || [])
        .filter((gr) => gr && typeof gr === "object") // Filter out invalid entries
        .map((gr) => ({
          role_id:
            gr.role && mongoose.Types.ObjectId.isValid(gr.role)
              ? gr.role
              : null,
          group_id:
            gr.group && mongoose.Types.ObjectId.isValid(gr.group)
              ? gr.group
              : null,
          userType: gr.userType,
          createdAt: gr.createdAt,
        }))
        .filter((gr) => gr.role_id && gr.group_id); // Only include valid entries

      const summary = {
        user_id: userId,
        network_roles: {
          count: networkRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: Math.max(0, ORGANISATIONS_LIMIT - networkRoles.length),
          roles: networkRoles,
        },
        group_roles: {
          count: groupRoles.length,
          limit: ORGANISATIONS_LIMIT,
          remaining: Math.max(0, ORGANISATIONS_LIMIT - groupRoles.length),
          roles: groupRoles,
        },
        total_roles: networkRoles.length + groupRoles.length,
      };

      logObject("✅ [DEBUG] Summary created successfully:", {
        networkRolesCount: summary.network_roles.count,
        groupRolesCount: summary.group_roles.count,
        totalRoles: summary.total_roles,
      });

      return summary;
    } catch (error) {
      logObject("🐛 [DEBUG] Error in getUserRoleSummary:", error);
      logger.error(`Error getting user role summary: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
      return null;
    }
  },

  /**
   * Enhanced assign user to role with detailed response
   */
  enhancedAssignUserToRole: async (request, next) => {
    try {
      const { role_id, user_id } = request.params;
      const { tenant, user, userType } = { ...request.body, ...request.query };

      // FIX: Properly handle default tenant
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

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

      // Validate input IDs
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid user ID format",
          })
        );
      }

      if (!mongoose.Types.ObjectId.isValid(role_id)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid role ID format",
          })
        );
      }

      const initialSummary = await rolePermissionUtil.getUserRoleSummary(
        userId,
        actualTenant
      );
      if (!initialSummary) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} not found`,
          })
        );
      }

      // Enhanced role existence check
      let role;
      try {
        role = await RoleModel(actualTenant).findById(role_id).lean();
      } catch (roleError) {
        return next(
          new HttpError("Database Error", httpStatus.INTERNAL_SERVER_ERROR, {
            message: `Error fetching role: ${roleError.message}`,
          })
        );
      }

      if (!role) {
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

      // Find the associated network/group ID with enhanced error handling
      let userObject;
      try {
        userObject = await UserModel(actualTenant).findById(userId).lean();
      } catch (userError) {
        return next(
          new HttpError("Database Error", httpStatus.INTERNAL_SERVER_ERROR, {
            message: `Error fetching user: ${userError.message}`,
          })
        );
      }

      if (!userObject) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${userId} not found`,
          })
        );
      }

      const userRoles = isNetworkRole
        ? userObject.network_roles
        : userObject.group_roles;
      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles: userRoles,
        tenant: actualTenant,
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
        tenant: actualTenant,
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

      const VALID_USER_TYPES = constants.VALID_USER_TYPES;
      let assignedUserType = userType || "guest";

      // Validate userType if provided
      if (userType && !VALID_USER_TYPES.includes(userType)) {
        return next(
          new HttpError("Invalid User Type", httpStatus.BAD_REQUEST, {
            message: `Invalid userType: ${userType}. Valid values are: ${VALID_USER_TYPES.join(
              ", "
            )}`,
          })
        );
      }

      logObject("🔍 [DEBUG] Assigning with userType:", assignedUserType);

      // Validate associatedId before database operation
      if (!mongoose.Types.ObjectId.isValid(associatedId)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid associated ID format",
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
            userType: assignedUserType,
            createdAt: new Date(),
          },
        },
      };

      // Enhanced database update with better error handling
      let updatedUser;
      try {
        updatedUser = await UserModel(actualTenant).findOneAndUpdate(
          { _id: userId },
          updateQuery,
          {
            new: true,
            runValidators: true,
          }
        );
      } catch (updateError) {
        logger.error("❌ [DEBUG] Database update error:", updateError.message);
        return next(
          new HttpError("Database Error", httpStatus.INTERNAL_SERVER_ERROR, {
            message: `Failed to assign user to role: ${updateError.message}`,
          })
        );
      }

      if (!updatedUser) {
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Failed to assign user to role - update returned null",
            }
          )
        );
      }

      // Get updated role summary
      const updatedSummary = await rolePermissionUtil.getUserRoleSummary(
        userId,
        actualTenant
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
          user_type: assignedUserType,
        },
        before_assignment: initialSummary,
        after_assignment: updatedSummary,
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("🐛 [DEBUG] Error in enhancedAssignUserToRole:", error);
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
      logObject("🔍 [DEBUG] enhancedUnAssignUserFromRole called");

      const { query, params } = request;
      const { role_id, user_id, tenant } = { ...query, ...params };

      logObject("📋 [DEBUG] Request params:", { role_id, user_id, tenant });

      // Fix 1: Properly handle default tenant
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      logObject("✅ [DEBUG] Using tenant:", actualTenant);

      // Fix 2: Use the simpler getUserRoleSummary (without populate)
      const initialSummary = await rolePermissionUtil.getUserRoleSummary(
        user_id,
        actualTenant
      );

      logObject("📋 [DEBUG] Initial summary result:", !!initialSummary);

      if (!initialSummary) {
        logObject("❌ [DEBUG] User not found:", user_id);
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      logObject("✅ [DEBUG] User found, fetching role and user details...");

      // Fix 3: Use simpler queries without complex populate operations
      const [userExists, roleExists] = await Promise.all([
        UserModel(actualTenant).exists({ _id: user_id }),
        RoleModel(actualTenant).exists({ _id: role_id }),
      ]);

      logObject("📋 [DEBUG] Existence checks:", {
        userExists: !!userExists,
        roleExists: !!roleExists,
      });

      if (!userExists || !roleExists) {
        return next(
          new HttpError("User or Role not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} or Role ${role_id} not found`,
          })
        );
      }

      // Fix 4: Get user and role data separately with better error handling
      const [userObject, role] = await Promise.all([
        UserModel(actualTenant).findById(user_id).lean(),
        RoleModel(actualTenant).findById(role_id).lean(),
      ]);

      if (!userObject || !role) {
        logObject("❌ [DEBUG] Failed to fetch user or role data");
        return next(
          new HttpError("User or Role data not found", httpStatus.BAD_REQUEST, {
            message: `Failed to fetch user or role data`,
          })
        );
      }

      logObject("✅ [DEBUG] User and role data fetched successfully");

      const roleType = isGroupRoleOrNetworkRole(role);
      logObject("📋 [DEBUG] Role type:", roleType);

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

      logObject("📋 [DEBUG] Current roles for user:", {
        roleType,
        rolesCount: roles?.length || 0,
        currentRolesCount: currentRoles?.count || 0,
      });

      // Check if role is actually assigned
      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);
      logObject("📋 [DEBUG] Is role assigned?", isRoleAssigned);

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

      logObject("🔍 [DEBUG] Finding associated ID...");
      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant: actualTenant,
      });

      logObject("📋 [DEBUG] Associated ID found:", associatedId);

      if (isEmpty(associatedId)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `The role ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to user ${user_id}`,
          })
        );
      }

      logObject("🔍 [DEBUG] Checking super admin status...");
      // Check for super admin restrictions
      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles,
        tenant: actualTenant,
      });

      logObject("📋 [DEBUG] Is super admin?", isSuperAdmin);

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

      logObject("🔄 [DEBUG] Performing unassignment...");

      // Fix 5: Safer database update operation
      const filter = {
        _id: user_id,
        [`${roleType}_roles.${roleType}`]: associatedId,
      };
      const update = {
        $set: { [`${roleType}_roles.$[elem].role`]: null },
      };
      const arrayFilters = [{ "elem.role": role_id }];

      logObject("📋 [DEBUG] Update operation:", {
        filter,
        update,
        arrayFilters,
      });

      const updatedUser = await UserModel(actualTenant).findOneAndUpdate(
        filter,
        update,
        { new: true, arrayFilters }
      );

      if (isEmpty(updatedUser)) {
        logObject("❌ [DEBUG] Update operation failed");
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "User not found or not assigned to the specified Role in the Network or Group provided",
          })
        );
      }

      logObject("✅ [DEBUG] User successfully updated");

      // Get updated role summary
      const updatedSummary = await rolePermissionUtil.getUserRoleSummary(
        user_id,
        actualTenant
      );

      logObject("✅ [DEBUG] Operation completed successfully");

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
      logObject("🐛 [DEBUG] Error in enhancedUnAssignUserFromRole:", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
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
      const { query, params } = request;
      const { user_id, tenant } = { ...query, ...params };

      // Handle default tenant
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      logObject(
        "🔍 [DEBUG] Getting network roles for user:",
        user_id,
        "in tenant:",
        actualTenant
      );

      // Use the getUserRoleSummary method that already works
      const roleSummary = await rolePermissionUtil.getUserRoleSummary(
        user_id,
        actualTenant
      );

      if (!roleSummary) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      // Return the network roles from the summary
      const response = {
        success: true,
        message: "Network roles retrieved successfully",
        data: {
          user_id: user_id,
          network_roles: roleSummary.network_roles,
          summary: {
            total_network_roles: roleSummary.network_roles.count,
            limit: roleSummary.network_roles.limit,
            remaining: roleSummary.network_roles.remaining,
          },
        },
        status: httpStatus.OK,
      };

      return response;
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
      const { query, params } = request;
      const { user_id, tenant } = { ...query, ...params };

      // Handle default tenant
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const actualTenant = isEmpty(tenant) ? defaultTenant : tenant;

      logObject(
        "🔍 [DEBUG] Getting group roles for user:",
        user_id,
        "in tenant:",
        actualTenant
      );

      // Use the getUserRoleSummary method that already works
      const roleSummary = await rolePermissionUtil.getUserRoleSummary(
        user_id,
        actualTenant
      );

      if (!roleSummary) {
        return next(
          new HttpError("User not found", httpStatus.BAD_REQUEST, {
            message: `User ${user_id} not found`,
          })
        );
      }

      // Return the group roles from the summary
      const response = {
        success: true,
        message: "Group roles retrieved successfully",
        data: {
          user_id: user_id,
          group_roles: roleSummary.group_roles,
          summary: {
            total_group_roles: roleSummary.group_roles.count,
            limit: roleSummary.group_roles.limit,
            remaining: roleSummary.group_roles.remaining,
          },
        },
        status: httpStatus.OK,
      };

      return response;
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
  getSystemRoleHealth: async (request, next) => {
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
  /**
   * Get comprehensive user roles and permissions organized by groups/networks
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  getUserRolesAndPermissionsDetailed: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant, group_id, network_id, include_all_groups } =
        request.query;

      if (!user_id) {
        return {
          success: false,
          message: "user_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id parameter is required" },
        };
      }

      // Prepare filters object
      const filters = {};
      if (group_id) {
        filters.group_id = group_id;
      }
      if (network_id) {
        filters.network_id = network_id;
      }
      if (include_all_groups !== undefined) {
        filters.include_all_groups = include_all_groups === "true";
      }

      const result = await getDetailedUserRolesAndPermissions(
        user_id,
        tenant,
        filters
      );

      if (!result) {
        return {
          success: false,
          message: `User ${user_id} not found`,
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      return {
        success: true,
        message: "Successfully retrieved detailed user roles and permissions",
        data: {
          ...result,
          tenant,
          generated_at: new Date().toISOString(),
          filters_applied: filters,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `getUserRolesAndPermissionsDetailed error: ${error.message}`
      );
      return {
        success: false,
        message: "Failed to retrieve user roles and permissions",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Get user permissions for a specific group (convenience method)
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object with group-specific permissions
   */
  getUserPermissionsForGroup: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant } = request.query;

      // Support both URL param and query param for group_id
      const group_id = request.params.group_id || request.query.group_id;

      if (!user_id) {
        return {
          success: false,
          message: "user_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id parameter is required" },
        };
      }

      if (!group_id) {
        return {
          success: false,
          message: "group_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "group_id parameter is required" },
        };
      }

      const filters = { group_id };
      const result = await getDetailedUserRolesAndPermissions(
        user_id,
        tenant,
        filters
      );

      if (!result) {
        return {
          success: false,
          message: `User ${user_id} not found`,
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      // Extract permissions for easy frontend consumption
      const groupPermissions =
        result.group_roles.length > 0 ? result.group_roles[0].permissions : [];
      const hasEditPermission =
        groupPermissions.includes("EDIT") ||
        groupPermissions.includes("GROUP_EDIT");
      const hasDeletePermission =
        groupPermissions.includes("DELETE") ||
        groupPermissions.includes("GROUP_DELETE");
      const hasUpdatePermission =
        groupPermissions.includes("UPDATE") ||
        groupPermissions.includes("GROUP_UPDATE");

      return {
        success: true,
        message: "Successfully retrieved user permissions for group",
        data: {
          user_id,
          group_id,
          group_info:
            result.group_roles.length > 0 ? result.group_roles[0].group : null,
          role_info:
            result.group_roles.length > 0 ? result.group_roles[0].role : null,
          permissions: groupPermissions,
          access_control: {
            can_edit: hasEditPermission,
            can_delete: hasDeletePermission,
            can_update: hasUpdatePermission,
          },
          tenant,
          generated_at: new Date().toISOString(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`getUserPermissionsForGroup error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve user permissions for group",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Bulk permissions check for multiple groups
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  bulkPermissionsCheck: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { group_ids, permissions } = request.body;
      const { tenant } = request.query;

      if (!user_id) {
        return {
          success: false,
          message: "user_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id parameter is required" },
        };
      }

      if (!group_ids || !Array.isArray(group_ids) || group_ids.length === 0) {
        return {
          success: false,
          message: "group_ids array is required and cannot be empty",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "group_ids array is required and cannot be empty",
          },
        };
      }

      const results = [];

      for (const group_id of group_ids) {
        try {
          // Create a temporary request object for each group
          const tempReq = {
            params: { user_id },
            query: { tenant, group_id },
          };

          const groupResult =
            await rolePermissionUtil.getUserPermissionsForGroup(tempReq, next);

          if (groupResult.success) {
            const groupData = groupResult.data;
            let permissionChecks = {};

            // If specific permissions were requested, check for them
            if (permissions && permissions.length > 0) {
              permissions.forEach((permission) => {
                permissionChecks[permission] =
                  groupData.permissions.includes(permission);
              });
            } else {
              // Return all permissions
              permissionChecks = groupData.access_control;
            }

            results.push({
              group_id,
              group_name: groupData.group_info?.name || "Unknown Group",
              role_name: groupData.role_info?.name || "No Role",
              permissions: groupData.permissions,
              permission_checks: permissionChecks,
              access_control: groupData.access_control,
            });
          } else {
            // Include failed group checks
            results.push({
              group_id,
              error: groupResult.message,
              permissions: [],
              permission_checks: {},
              access_control: {
                can_edit: false,
                can_delete: false,
                can_update: false,
              },
            });
          }
        } catch (error) {
          results.push({
            group_id,
            error: error.message,
            permissions: [],
            permission_checks: {},
            access_control: {
              can_edit: false,
              can_delete: false,
              can_update: false,
            },
          });
        }
      }

      return {
        success: true,
        message: `Successfully checked permissions for ${group_ids.length} groups`,
        data: {
          user_id,
          groups_checked: group_ids.length,
          results,
          summary: {
            total_groups: results.length,
            groups_with_access: results.filter((r) => !r.error).length,
            groups_with_errors: results.filter((r) => r.error).length,
          },
          generated_at: new Date().toISOString(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`bulkPermissionsCheck error: ${error.message}`);
      return {
        success: false,
        message: "Failed to complete bulk permissions check",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Get simplified permissions for frontend components
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  getSimplifiedPermissionsForGroup: async (request, next) => {
    try {
      const result = await rolePermissionUtil.getUserPermissionsForGroup(
        request,
        next
      );

      if (!result.success) {
        return result;
      }

      // Return only the essential information for frontend
      return {
        success: true,
        message: "Successfully retrieved simplified permissions",
        data: {
          user_id: result.data.user_id,
          group_id: result.data.group_id,
          permissions: result.data.permissions,
          can_edit: result.data.access_control.can_edit,
          can_delete: result.data.access_control.can_delete,
          can_update: result.data.access_control.can_update,
          role_name: result.data.role_info?.name,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`getSimplifiedPermissionsForGroup error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve simplified permissions",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Check user permissions for specific actions
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  checkUserPermissionsForActions: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant, group_id } = request.query;
      const { actions } = request.body;

      if (!actions || !Array.isArray(actions)) {
        return {
          success: false,
          message: "actions array is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "actions array is required" },
        };
      }

      const result = await rolePermissionUtil.getUserPermissionsForGroup(
        { params: { user_id }, query: { tenant, group_id } },
        next
      );

      if (!result.success) {
        return result;
      }

      const userPermissions = result.data.permissions;
      const actionChecks = {};

      actions.forEach((action) => {
        actionChecks[action] = userPermissions.includes(action);
      });

      return {
        success: true,
        message: "Successfully checked user permissions for actions",
        data: {
          user_id,
          group_id,
          actions_checked: actions,
          action_permissions: actionChecks,
          all_actions_allowed: Object.values(actionChecks).every(
            (allowed) => allowed
          ),
          generated_at: new Date().toISOString(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`checkUserPermissionsForActions error: ${error.message}`);
      return {
        success: false,
        message: "Failed to check user permissions for actions",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Get user roles filtered by group with enhanced details
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  getUserRolesByGroup: async (request, next) => {
    try {
      const result =
        await rolePermissionUtil.getUserRolesAndPermissionsDetailed(
          request,
          next
        );

      if (!result.success) {
        return result;
      }

      // Focus on group roles only
      return {
        success: true,
        message: "Successfully retrieved user roles for group",
        data: {
          user: result.data.user,
          group_roles: result.data.group_roles,
          summary: {
            total_group_roles: result.data.group_roles.length,
            total_permissions: result.data.summary.total_unique_permissions,
            permissions: result.data.summary.all_permissions,
          },
          filters_applied: result.data.filters_applied,
          generated_at: new Date().toISOString(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`getUserRolesByGroup error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve user roles for group",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Get all groups with user's permissions summary
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  getUserGroupsWithPermissionsSummary: async (request, next) => {
    try {
      // Get all groups for the user (no filtering)
      const tempReq = {
        ...request,
        query: { ...request.query },
      };

      tempReq.query.group_id = undefined;
      const result =
        await rolePermissionUtil.getUserRolesAndPermissionsDetailed(
          tempReq,
          next
        );

      if (!result.success) {
        return result;
      }

      // Create summary for each group
      const groupsSummary = result.data.group_roles.map((groupRole) => ({
        group: groupRole.group,
        role: groupRole.role,
        permissions_count: groupRole.permissions_count,
        key_permissions: {
          can_edit:
            groupRole.permissions.includes("GROUP_EDIT") ||
            groupRole.permissions.includes("EDIT"),
          can_delete:
            groupRole.permissions.includes("GROUP_DELETE") ||
            groupRole.permissions.includes("DELETE"),
          can_update:
            groupRole.permissions.includes("GROUP_UPDATE") ||
            groupRole.permissions.includes("UPDATE"),
          can_manage_users: groupRole.permissions.includes("USER_MANAGEMENT"),
          can_manage_members:
            groupRole.permissions.includes("MEMBER_INVITE") ||
            groupRole.permissions.includes("MEMBER_REMOVE"),
        },
        user_type: groupRole.user_type,
        assigned_at: groupRole.assigned_at,
      }));

      return {
        success: true,
        message: "Successfully retrieved groups with permissions summary",
        data: {
          user: result.data.user,
          groups_summary: groupsSummary,
          overall_summary: {
            total_groups: groupsSummary.length,
            groups_with_edit_access: groupsSummary.filter(
              (g) => g.key_permissions.can_edit
            ).length,
            groups_with_delete_access: groupsSummary.filter(
              (g) => g.key_permissions.can_delete
            ).length,
            groups_with_user_management: groupsSummary.filter(
              (g) => g.key_permissions.can_manage_users
            ).length,
            total_unique_permissions:
              result.data.summary.total_unique_permissions,
          },
          generated_at: new Date().toISOString(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `getUserGroupsWithPermissionsSummary error: ${error.message}`
      );
      return {
        success: false,
        message: "Failed to retrieve groups with permissions summary",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  getCurrentUserRolesAndPermissions: async (request, next) => {
    try {
      if (!request.user || !request.user._id) {
        return {
          success: false,
          message: "Authentication required",
          status: httpStatus.UNAUTHORIZED,
          errors: { message: "User not authenticated" },
        };
      }

      const result = await getDetailedUserRolesAndPermissions(
        request.user._id,
        request.query.tenant
      );

      if (!result) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      return {
        success: true,
        message: "Successfully retrieved your detailed roles and permissions",
        data: {
          ...result,
          tenant: request.query.tenant,
          generated_at: new Date().toISOString(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`getCurrentUserRolesAndPermissions error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve current user roles and permissions",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Get user roles and permissions using RBAC service for enhanced functionality
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  getUserRolesAndPermissionsViaRBAC: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant, include_inherited = false } = request.query;

      if (!user_id) {
        return {
          success: false,
          message: "user_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id parameter is required" },
        };
      }

      // Use RBAC service for comprehensive role analysis
      const rbacService = new RBACService(tenant);

      // Get effective permissions from RBAC service
      const effectivePermissions =
        await rbacService.getUserEffectivePermissions(user_id);

      if (
        !effectivePermissions ||
        Object.keys(effectivePermissions).length === 0
      ) {
        return {
          success: false,
          message: `User ${user_id} not found or has no role assignments`,
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found or no roles assigned" },
        };
      }

      // Get basic user info
      const user = await UserModel(tenant)
        .findById(user_id)
        .select("_id email firstName lastName isActive verified")
        .lean();

      if (!user) {
        return {
          success: false,
          message: `User ${user_id} not found`,
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      // Transform group permissions into desired format
      const groupDetails = [];
      for (const [groupId, groupData] of Object.entries(
        effectivePermissions.group_permissions || {}
      )) {
        groupDetails.push({
          group: {
            _id: groupId,
            name: groupData.group_name,
          },
          role: groupData.role,
          permissions: groupData.permissions,
          permissions_count: groupData.permissions.length,
        });
      }

      // Transform network permissions into desired format
      const networkDetails = [];
      for (const [networkId, networkData] of Object.entries(
        effectivePermissions.network_permissions || {}
      )) {
        networkDetails.push({
          network: {
            _id: networkId,
            name: networkData.network_name,
          },
          role: networkData.role,
          permissions: networkData.permissions,
          permissions_count: networkData.permissions.length,
        });
      }

      const responseData = {
        user: {
          _id: user._id,
          email: user.email,
          first_name: user.firstName,
          last_name: user.lastName,
          full_name: `${user.firstName} ${user.lastName}`,
          is_active: user.isActive,
          verified: user.verified,
        },
        tenant: tenant,
        group_roles: groupDetails,
        network_roles: networkDetails,
        summary: {
          total_groups: groupDetails.length,
          total_networks: networkDetails.length,
          total_unique_permissions:
            effectivePermissions.global_permissions.length,
          all_permissions: effectivePermissions.global_permissions.sort(),
          is_system_super_admin: effectivePermissions.is_system_super_admin,
        },
        rbac_analysis: {
          is_system_super_admin: effectivePermissions.is_system_super_admin,
          global_permissions: effectivePermissions.global_permissions,
        },
        generated_at: new Date().toISOString(),
      };

      return {
        success: true,
        message:
          "Successfully retrieved detailed user roles and permissions via RBAC",
        data: responseData,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`getUserRolesAndPermissionsViaRBAC error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve user roles and permissions via RBAC",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Get simplified user roles and permissions
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  getUserRolesSimplified: async (request, next) => {
    try {
      const { user_id } = request.params;
      const { tenant } = request.query;

      if (!user_id) {
        return {
          success: false,
          message: "user_id parameter is required",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "user_id parameter is required" },
        };
      }

      // Get user data without populate to avoid schema registration issues
      const user = await UserModel(tenant).findById(user_id).lean();

      if (!user) {
        return {
          success: false,
          message: `User ${user_id} not found`,
          status: httpStatus.NOT_FOUND,
          errors: { message: "User not found" },
        };
      }

      // Manual population for group roles
      const groupRolesData = [];
      for (const groupRole of user.group_roles || []) {
        try {
          // Fetch group details
          const group = groupRole.group
            ? await GroupModel(tenant)
                .findById(groupRole.group)
                .select("_id grp_title")
                .lean()
            : null;

          // Fetch role details without populate, then manually populate permissions
          let role = null;
          let permissions = [];

          if (groupRole.role) {
            try {
              role = await RoleModel(tenant).findById(groupRole.role).lean();
              if (role) {
                const populatedRole = await manuallyPopulateRolePermissions(
                  role,
                  tenant
                );
                role = populatedRole;
                permissions = (role.role_permissions || []).map(
                  (p) => p.permission
                );
              }
            } catch (roleError) {
              logger.error(`Error fetching role: ${roleError.message}`);
            }
          }

          groupRolesData.push({
            group_id: group?._id,
            group_name: group?.grp_title,
            role_id: role?._id,
            role_name: role?.role_name,
            permissions: permissions,
          });
        } catch (error) {
          logger.error(`Error processing group role: ${error.message}`);
          // Continue with next role even if one fails
          groupRolesData.push({
            group_id: groupRole.group,
            group_name: "Unknown Group",
            role_id: groupRole.role,
            role_name: "Unknown Role",
            permissions: [],
          });
        }
      }

      // Manual population for network roles
      const networkRolesData = [];
      for (const networkRole of user.network_roles || []) {
        try {
          // For network, we might not have a NetworkModel, so we'll handle it gracefully
          let network = null;
          if (networkRole.network) {
            try {
              // Try to get network details if NetworkModel exists
              // Since NetworkModel might not exist, we'll create a placeholder
              network = {
                _id: networkRole.network,
                net_name: "Network", // Placeholder name
              };
            } catch (networkError) {
              logger.warn(
                `Could not fetch network details: ${networkError.message}`
              );
            }
          }

          // Fetch role details without populate, then manually populate permissions
          let role = null;
          let permissions = [];

          if (networkRole.role) {
            try {
              role = await RoleModel(tenant).findById(networkRole.role).lean();
              if (role) {
                const populatedRole = await manuallyPopulateRolePermissions(
                  role,
                  tenant
                );
                role = populatedRole;
                permissions = (role.role_permissions || []).map(
                  (p) => p.permission
                );
              }
            } catch (roleError) {
              logger.error(`Error fetching network role: ${roleError.message}`);
            }
          }

          networkRolesData.push({
            network_id: network?._id,
            network_name: network?.net_name,
            role_id: role?._id,
            role_name: role?.role_name,
            permissions: permissions,
          });
        } catch (error) {
          logger.error(`Error processing network role: ${error.message}`);
          // Continue with next role even if one fails
          networkRolesData.push({
            network_id: networkRole.network,
            network_name: "Unknown Network",
            role_id: networkRole.role,
            role_name: "Unknown Role",
            permissions: [],
          });
        }
      }

      // Simplified structure
      const responseData = {
        user_id: user._id,
        groups: groupRolesData,
        networks: networkRolesData,
      };

      return {
        success: true,
        message: "Successfully retrieved simplified user roles",
        data: responseData,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`getUserRolesSimplified error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve simplified user roles",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Get user roles and permissions for current authenticated user
   * @param {Object} request - Express request object
   * @param {Function} next - Express next function
   * @returns {Promise<Object>} Standard response object
   */
  getCurrentUserRolesAndPermissions: async (request, next) => {
    try {
      // Set user_id from authenticated user
      if (!request.user || !request.user._id) {
        return {
          success: false,
          message: "Authentication required",
          status: httpStatus.UNAUTHORIZED,
          errors: { message: "User not authenticated" },
        };
      }

      // Create a new request object with the current user's ID
      const modifiedRequest = {
        ...request,
        params: {
          ...request.params,
          user_id: request.user._id,
        },
      };

      // Use the detailed method for current user
      return await rolePermissionUtil.getUserRolesAndPermissionsDetailed(
        modifiedRequest,
        next
      );
    } catch (error) {
      logger.error(`getCurrentUserRolesAndPermissions error: ${error.message}`);
      return {
        success: false,
        message: "Failed to retrieve current user roles and permissions",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

module.exports = {
  ...rolePermissionUtil,
  setupDefaultPermissions,
  createDefaultRolesForOrganization,
  createOrUpdateRole,
  resetRBACData,
  updateTenantSettingsWithDefaultRoles,
  ensureSuperAdminRole,
  generateRoleCode,
};
