// @bin/jobs/role-init-job.js
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- role-init-job`);
const nodeCron = require("node-cron");

// Track initialization status for diagnostics
let initializationComplete = false;
let initializationError = null;

/**
 * Initialize or verify admin roles in the system
 * This creates the necessary SUPER_ADMIN role with appropriate permissions
 * for the AirQo group if it doesn't exist
 */
async function initializeAdminRoles() {
  try {
    // Import models directly - this assumes they're properly registered
    const RoleModel = require("@models/Role");
    const PermissionModel = require("@models/Permission");
    const GroupModel = require("@models/Group");

    // Find the AirQo group
    const airqoGroup = await GroupModel("airqo").findOne({
      grp_title: "airqo",
    });
    if (!airqoGroup) {
      throw new Error("AirQo group not found, cannot initialize admin roles");
    }

    // Check if AIRQO_SUPER_ADMIN role exists
    const superAdminRoleName = `${airqoGroup.grp_title.toUpperCase()}_SUPER_ADMIN`;
    let superAdminRole = await RoleModel("airqo").findOne({
      role_name: superAdminRoleName,
    });

    // If role already exists, just return it
    if (superAdminRole) {
      // Role already exists
      return { role: superAdminRole, created: false };
    }

    // Define required permissions for the super admin role
    const requiredPermissions = [
      "LIST_ORGANIZATION_REQUESTS",
      "APPROVE_ORGANIZATION_REQUEST",
      "REJECT_ORGANIZATION_REQUEST",
      "VIEW_ORGANIZATION_REQUEST",
      // Add other required permissions here
    ];

    // Ensure all required permissions exist
    for (const permission of requiredPermissions) {
      const exists = await PermissionModel("airqo").findOne({ permission });

      if (!exists) {
        await PermissionModel("airqo").create({
          permission,
          description: `Permission to ${permission
            .toLowerCase()
            .replace(/_/g, " ")}`,
          group_id: airqoGroup._id,
        });
      }
    }

    // Get all permission IDs
    const permissionDocs = await PermissionModel("airqo").find({
      permission: { $in: requiredPermissions },
    });

    const permissionIds = permissionDocs.map((doc) => doc._id);

    // Create the super admin role
    superAdminRole = await RoleModel("airqo").create({
      role_name: superAdminRoleName,
      role_code: superAdminRoleName,
      role_description: "Super administrator role for AirQo",
      group_id: airqoGroup._id,
      role_permissions: permissionIds,
    });

    return {
      role: superAdminRole,
      created: true,
      permissionCount: permissionIds.length,
    };
  } catch (error) {
    logger.error(`Role initialization error: ${error.message}`);
    logger.error(error.stack);
    throw error;
  }
}

/**
 * Run the role initialization process
 */
async function runRoleInitialization() {
  try {
    // Initialize admin roles
    const result = await initializeAdminRoles();

    // Update status
    initializationComplete = true;

    // Output a success message depending on whether the role was created or verified
    if (result.created) {
      console.log(
        `✅ AIRQO_SUPER_ADMIN role created successfully with ${result.permissionCount} permissions`
      );
    } else {
      console.log(`✅ AIRQO_SUPER_ADMIN role verified (already exists)`);
    }

    // Success is minimal logging, just return the result
    return result.role;
  } catch (error) {
    console.error("❌ Error during role initialization:", error.message);
    // Store error status
    initializationError = error;
    logger.error(`Failed to initialize admin roles: ${error.message}`);
    return null;
  }
}

/**
 * Schedule periodic role verification using node-cron
 */
function scheduleRoleVerification() {
  try {
    // Schedule daily verification at midnight
    const cronSchedule = "0 0 * * *";

    if (nodeCron.validate(cronSchedule)) {
      nodeCron.schedule(cronSchedule, async () => {
        try {
          // Run verification silently
          await runRoleInitialization();
        } catch (error) {
          logger.error(`Scheduled role verification error: ${error.message}`);
        }
      });
    } else {
      logger.error(`Invalid cron schedule pattern: ${cronSchedule}`);
    }
  } catch (error) {
    logger.error(`Failed to schedule role verification: ${error.message}`);
  }
}

// Run initialization after a small delay to ensure models are loaded
setTimeout(() => {
  console.log("🔄 Starting admin role initialization check...");

  // Run the initialization
  runRoleInitialization().catch((err) => {
    console.error(`❌ Role initialization error: ${err.message}`);
    logger.error(`Role initialization error: ${err.message}`);
  });

  // Set up scheduled verification
  scheduleRoleVerification();
}, 1000);

// Export for testing and diagnostics
module.exports = {
  runRoleInitialization,
  getStatus: () => ({
    complete: initializationComplete,
    error: initializationError ? initializationError.message : null,
  }),
};
