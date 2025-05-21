const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- role-init-job`);
const nodeCron = require("node-cron");
const mongoose = require("mongoose");

// Track initialization status for diagnostics
let initializationComplete = false;
let initializationError = null;

// Retry mechanism parameters
let initRetryCount = 0;
const maxRetries = 5;
const retryDelay = 2000; // Initial delay in milliseconds (2 seconds)

/**
 * Initialize or verify admin roles in the system
 */
async function initializeAdminRoles() {
  try {
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

    if (superAdminRole) {
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
    const result = await initializeAdminRoles();
    initializationComplete = true;

    if (result.created) {
      console.log(
        `✅ AIRQO_SUPER_ADMIN role created successfully with ${result.permissionCount} permissions`
      );
    } else {
      console.log(`✅ AIRQO_SUPER_ADMIN role verified (already exists)`);
    }
    return result.role;
  } catch (error) {
    initializationError = error;
    console.error("❌ Error during role initialization:", error.message);
    logger.error(`Failed to initialize admin roles: ${error.message}`);
    return null;
  }
}

/**
 * Schedule periodic role verification using node-cron
 */
function scheduleRoleVerification() {
  try {
    const cronSchedule = "0 0 * * *"; // Daily at midnight
    if (nodeCron.validate(cronSchedule)) {
      nodeCron.schedule(cronSchedule, async () => {
        try {
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

/**
 * Retry logic with exponential backoff
 */
function retryInit() {
  initRetryCount++;
  if (initRetryCount < maxRetries) {
    const delay = retryDelay * Math.pow(1.5, initRetryCount - 1);
    console.log(`🔄 Retrying in ${(delay / 1000).toFixed(1)} seconds...`);
    setTimeout(runWithRetry, delay);
  } else {
    console.error(
      "❌ Maximum retry attempts reached. Role initialization failed."
    );
    logger.error("Maximum retry attempts reached. Role initialization failed.");
  }
}

/**
 * Run initialization with retry and exponential backoff
 */
function runWithRetry() {
  console.log(
    `🔄 Starting admin role initialization check (attempt ${
      initRetryCount + 1
    }/${maxRetries})...`
  );
  runRoleInitialization()
    .then((role) => {
      if (role) {
        scheduleRoleVerification();
      } else {
        retryInit();
      }
    })
    .catch(() => {
      retryInit();
    });
}

/**
 * Main entry point: Wait for Mongoose connection before running initialization
 */
function startRoleInitJob() {
  if (mongoose.connection.readyState === 1) {
    // Already connected
    runWithRetry();
  } else {
    // Wait for connection
    mongoose.connection.once("connected", () => {
      runWithRetry();
    });
    mongoose.connection.once("error", (err) => {
      logger.error("MongoDB connection error (init job):", err);
    });
  }
}

// Export for explicit control from server.js
module.exports = {
  startRoleInitJob,
  runRoleInitialization,
  getStatus: () => ({
    complete: initializationComplete,
    error: initializationError ? initializationError.message : null,
  }),
};
