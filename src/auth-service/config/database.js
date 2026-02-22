const mongoose = require("mongoose");
mongoose.set("useNewUrlParser", true);
mongoose.set("useFindAndModify", false);
mongoose.set("useCreateIndex", true);
// mongoose.set("debug", process.env.NODE_ENV === "development");
const constants = require("./constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- config-database`);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const COMMAND_URI = constants.COMMAND_MONGO_URI || constants.MONGO_URI || "";
const QUERY_URI = constants.QUERY_MONGO_URI || constants.MONGO_URI || "";

const options = {
  useCreateIndex: true,
  useNewUrlParser: true,
  useFindAndModify: false,
  useUnifiedTopology: true,
  autoIndex: true,
  poolSize: 10,
  bufferMaxEntries: 0,
  connectTimeoutMS: 1200000,
  socketTimeoutMS: 600000,
  serverSelectionTimeoutMS: 3600000,
};

let rbacInitialized = false; // Flag to ensure RBAC initialization runs only once

const validatePermissionsFile = () => {
  const { ALL, DEFAULT_ROLE_DEFINITIONS } = require("@config/constants");
  const errors = [];

  if (!ALL || !Array.isArray(ALL) || ALL.length === 0) {
    errors.push("PERMISSIONS.ALL array is missing, empty, or invalid.");
  }

  if (
    !DEFAULT_ROLE_DEFINITIONS ||
    typeof DEFAULT_ROLE_DEFINITIONS !== "object" ||
    Object.keys(DEFAULT_ROLE_DEFINITIONS).length === 0
  ) {
    errors.push(
      "PERMISSIONS.DEFAULT_ROLE_DEFINITIONS object is missing or empty.",
    );
    // Stop further checks if the main object is missing
    return errors;
  }

  for (const [roleKey, roleDef] of Object.entries(DEFAULT_ROLE_DEFINITIONS)) {
    if (!roleDef.role_name || typeof roleDef.role_name !== "string") {
      errors.push(`Role '${roleKey}' is missing a valid 'role_name'.`);
    }
    if (!roleDef.role_code || typeof roleDef.role_code !== "string") {
      errors.push(`Role '${roleKey}' is missing a valid 'role_code'.`);
    }
    if (
      !roleDef.role_description ||
      typeof roleDef.role_description !== "string"
    ) {
      errors.push(`Role '${roleKey}' is missing a valid 'role_description'.`);
    }
    if (!roleDef.permissions || !Array.isArray(roleDef.permissions)) {
      errors.push(`Role '${roleKey}' is missing a valid 'permissions' array.`);
    } else {
      // Check if all permissions in the role definition exist in PERMISSIONS.ALL
      for (const perm of roleDef.permissions) {
        if (!ALL.includes(perm)) {
          errors.push(
            `Role '${roleKey}' contains an undefined permission: '${perm}'.`,
          );
        }
      }
    }
  }

  return errors;
};

const initializeRBAC = async () => {
  if (rbacInitialized) {
    console.log("⏭️  RBAC system already initialized. Skipping.");
    return;
  }

  // Health check for the permissions file
  const permissionFileErrors = validatePermissionsFile();
  if (permissionFileErrors.length > 0) {
    console.error("❌ CRITICAL RBAC CONFIGURATION ERROR:");
    permissionFileErrors.forEach((err) => console.error(`   - ${err}`));
    console.error(
      "🚨 Halting application startup due to invalid RBAC configuration in permissions.js",
    );
    throw new Error(
      `Invalid RBAC configuration: ${permissionFileErrors.join("; ")}`,
    );
  }
  console.log("✅ RBAC configuration file health check passed.");

  try {
    console.log("🚀 Initializing default permissions and roles...");
    const rolePermissionsUtil = require("@utils/role-permissions.util");
    // The setupDefaultPermissions function is designed to be idempotent.
    // It will create what's missing and update what's changed.
    const result = await rolePermissionsUtil.setupDefaultPermissions("airqo");

    if (result && result.success && result.data) {
      const {
        permissions,
        airqo_roles,
        global_roles,
        audit,
        airqo_super_admin_exists,
        role_errors,
      } = result.data;
      console.log("✅ RBAC initialization completed successfully.");
      rbacInitialized = true; // Set flag after successful initialization
      if (permissions) {
        console.log(
          `   📊 Permissions: ${permissions.created} created, ${permissions.updated} updated, ${permissions.existing} existing.`,
        );
      }
      if (airqo_roles) {
        console.log(
          `   📊 AirQo Roles: ${airqo_roles.created} created, ${airqo_roles.updated} updated, ${airqo_roles.up_to_date} up-to-date.`,
        );
      }
      console.log(
        `   📊 Audit: ${audit.organization_roles_audited} org roles audited, ${audit.permissions_added_to_roles} permissions added.`,
      );
      console.log(`   👑 Super Admin Role Exists: ${airqo_super_admin_exists}`);
      if (role_errors && role_errors.length > 0) {
        console.warn("   ⚠️ Some role creation issues occurred:");
        role_errors.forEach((error) => {
          console.warn(`      - ${error.role_name}: ${error.error}`);
        });
      }
    } else {
      console.error(
        "❌ RBAC initialization failed:",
        result ? result.message : "Unknown error",
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 RBAC Initialization Error -- ${error.message}`);
    rbacInitialized = false; // Allow retry on next start if it fails
  }
};

// Create separate connection instances for command and query
const createCommandConnection = () =>
  mongoose.createConnection(COMMAND_URI, {
    ...options,
    dbName: `${constants.DB_NAME}_command`,
  });

const createQueryConnection = () =>
  mongoose.createConnection(QUERY_URI, {
    ...options,
    dbName: `${constants.DB_NAME}`,
  });

// Connection storage
let commandDB = null;
let queryDB = null;
let isConnected = false;

const setupConnectionHandlers = (db, dbType) => {
  db.on("open", () => {
    logger.info(`Connected to ${dbType} database`);
  });

  db.on("error", (err) => {
    logger.error(`${dbType} database connection error: ${err.message}`);
  });

  db.on("disconnected", () => {
    logger.warn(`${dbType} database disconnected`);
  });
};

const connectToMongoDB = () => {
  if (isConnected) {
    logger.info(
      "MongoDB connections are already established. Skipping re-initialization.",
    );
    return { commandDB, queryDB };
  }

  try {
    // Connect to command database
    commandDB = createCommandConnection();
    setupConnectionHandlers(commandDB, "command");

    // Connect to query database
    queryDB = createQueryConnection();
    setupConnectionHandlers(queryDB, "query");

    const handleDBInitialization = async () => {
      console.log("✅ MongoDB connected, proceeding with initializations...");
      try {
        await initializeRBAC();

        // Initialize guest user after RBAC
        console.log("🚀 Initializing guest user across all tenants...");
        const {
          ensureGuestUserExists,
        } = require("@bin/jobs/guest-user-init-job");
        await ensureGuestUserExists().catch((error) => {
          logger.error(`Guest user initialization failed: ${error.message}`);
          // Don't crash the app - guest user creation failure is non-critical
        });

        // Run default group initialization in the background
        const {
          ensureDefaultAirqoGroupExists,
        } = require("@bin/jobs/default-group-init-job");
        console.log("🚀 Kicking off default group initialization...");
        ensureDefaultAirqoGroupExists().catch((err) => {
          logger.error(
            `Background job 'ensureDefaultAirqoGroupExists' failed: ${err.message}`,
          );
        });
        // Also run the token migration job now that DB is ready
        const {
          migrateTokenStrategiesToDefault,
        } = require("@bin/jobs/token-strategy-migration-job");
        console.log("🚀 Kicking off token strategy migration on startup...");
        migrateTokenStrategiesToDefault().catch((err) => {
          logger.error(`Startup migration failed: ${err.message}`);
        });

        // Run legacy role name migration in the background
        const {
          runLegacyRoleMigration,
        } = require("@migrations/rename-legacy-roles");
        console.log("🚀 Kicking off legacy role name migration on startup...");
        const tenants = constants.TENANTS || ["airqo"];
        Promise.all(tenants.map((t) => runLegacyRoleMigration(t))).catch(
          (err) => {
            logger.error(
              `Background migration 'runLegacyRoleMigration' failed: ${err.message}`,
            );
          },
        );
      } catch (err) {
        logger.fatal(
          "❌ RBAC initialization failed on connection:",
          err.message,
        );
        if (
          process.env.NODE_ENV !== "test" &&
          process.env.ALLOW_RBAC_STARTUP_ERRORS !== "true"
        ) {
          process.exit(1);
        }
      }
    };

    // Listen to the 'open' event on the query database connection
    if (queryDB.readyState === 1) {
      handleDBInitialization();
    } else {
      queryDB.on("open", handleDBInitialization);
    }

    // Error handling for the Node process
    process.on("unhandledRejection", (reason, p) => {
      logger.error("Unhandled Rejection at: Promise", p, "reason:", reason);
    });

    process.on("uncaughtException", (err) => {
      logger.error("There was an uncaught error", err);
    });

    isConnected = true;

    return { commandDB, queryDB };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    throw error;
  }
};

// Initialize connections
const { commandDB: commandMongoDB, queryDB: queryMongoDB } = connectToMongoDB();

/**
 * Get a tenant-specific database from command DB (for write operations)
 */
function getCommandTenantDB(tenantId, modelName, schema) {
  const dbName = `${constants.DB_NAME}_command_${tenantId}`;
  if (commandMongoDB) {
    const db = commandMongoDB.useDb(dbName, { useCache: true });
    db.model(modelName, schema);
    return db;
  }
  throw new Error("Command database connection not established");
}

/**
 * Get a tenant-specific database from query DB (for read operations)
 */
function getQueryTenantDB(tenantId, modelName, schema) {
  // const dbName = `${constants.DB_NAME}_query_${tenantId}`;
  const dbName = `${constants.DB_NAME}_${tenantId}`;
  if (queryMongoDB) {
    const db = queryMongoDB.useDb(dbName, { useCache: true });
    try {
      db.model(modelName);
    } catch {
      // Model doesn't exist, register it
      db.model(modelName, schema);
    }
    return db;
  }
  throw new Error("Query database connection not established");
}

/**
 * Get command model (for write operations) by tenant
 */
function getCommandModelByTenant(tenantId, modelName, schema) {
  const tenantDb = getCommandTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
}

/**
 * Get query model (for read operations) by tenant
 */
function getQueryModelByTenant(tenantId, modelName, schema) {
  const tenantDb = getQueryTenantDB(tenantId, modelName, schema);
  return tenantDb.model(modelName);
}

/**
 * For backward compatibility - automatically selects appropriate database
 * based on operation type (default: query database)
 */
function getModelByTenant(
  tenantId,
  modelName,
  schema,
  operationType = "query",
) {
  if (operationType === "command") {
    return getCommandModelByTenant(tenantId, modelName, schema);
  }
  return getQueryModelByTenant(tenantId, modelName, schema);
}

/**
 * For backward compatibility
 */
function getTenantDB(tenantId, modelName, schema, operationType = "query") {
  if (operationType === "command") {
    return getCommandTenantDB(tenantId, modelName, schema);
  }
  return getQueryTenantDB(tenantId, modelName, schema);
}

module.exports = {
  getModelByTenant,
  getTenantDB,
  connectToMongoDB,
  getCommandModelByTenant,
  getQueryModelByTenant,
  getCommandTenantDB,
  getQueryTenantDB,
  isConnected,
};
