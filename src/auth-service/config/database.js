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

// Reserved for a future separate command/write DB endpoint (constants.COMMAND_MONGO_URI).
// Currently unused — the app runs a single unified connection via QUERY_URI.
// const COMMAND_URI = constants.COMMAND_MONGO_URI || constants.MONGO_URI || "";

// QUERY_URI resolves to MONGO_URI as fallback; intentional single unified connection.
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

let rbacInitialized = false;

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
      rbacInitialized = true;
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
    rbacInitialized = false;
  }
};

// Connection storage
let mainConnection = mongoose.connection;
let isConnected = false; // true only after RBAC/init completes successfully
let connectionOpen = false; // true as soon as the driver connection is open, independent of init state
let _initPromise = null; // shared promise for callers that arrive while init is in progress
let _processHandlersRegistered = false;

const setupConnectionHandlers = (db, dbType) => {
  db.on("open", () => {
    logger.info(`Connected to ${dbType} database`);
  });

  db.on("error", (err) => {
    logger.error(`${dbType} database connection error: ${err.message}`);
  });

  db.on("disconnected", () => {
    if (dbType === "query" || dbType === "main") {
      isConnected = false;
      connectionOpen = false;
    }
    logger.warn(`${dbType} database disconnected`);
  });

  db.on("reconnected", () => {
    if ((dbType === "query" || dbType === "main") && rbacInitialized) {
      isConnected = true;
      connectionOpen = true;
    }
    logger.info(`${dbType} database reconnected`);
  });
};

const connectToMongoDB = () => {
  // If the driver is already open, return a resolved promise.
  // isConnected tracks RBAC/init completion; readyState tracks the driver.
  // Checking both separately prevents a duplicate mongoose.connect() call
  // when init failed/was skipped but the driver connection is already open.
  if (mainConnection && mainConnection.readyState === 1) {
    if (isConnected) {
      logger.info(
        "MongoDB connections are already established and initialized. Skipping re-initialization.",
      );
    } else {
      logger.warn(
        "MongoDB driver connection is already open but initialization is not complete. Skipping reconnection.",
      );
    }
    return Promise.resolve(mainConnection);
  }

  // Return the shared in-progress promise so concurrent callers wait on the
  // same init rather than racing to open duplicate connections.
  if (_initPromise) {
    logger.info(
      "MongoDB connection already in progress. Returning existing init promise.",
    );
    return _initPromise;
  }

  _initPromise = (async () => {
    try {
      await mongoose.connect(QUERY_URI, options);
      mainConnection = mongoose.connection;
      setupConnectionHandlers(mainConnection, "main");
      connectionOpen = true;
      console.log("✅ MongoDB connected, proceeding with initializations...");

      try {
        await initializeRBAC();

        console.log("🚀 Initializing guest user across all tenants...");
        const {
          ensureGuestUserExists,
        } = require("@bin/jobs/guest-user-init-job");
        await ensureGuestUserExists().catch((error) => {
          logger.error(`Guest user initialization failed: ${error.message}`);
        });

        const {
          ensureDefaultAirqoGroupExists,
        } = require("@bin/jobs/default-group-init-job");
        console.log("🚀 Kicking off default group initialization...");
        ensureDefaultAirqoGroupExists().catch((err) => {
          logger.error(
            `Background job 'ensureDefaultAirqoGroupExists' failed: ${err.message}`,
          );
        });

        const {
          migrateTokenStrategiesToDefault,
        } = require("@bin/jobs/token-strategy-migration-job");
        console.log("🚀 Kicking off token strategy migration on startup...");
        migrateTokenStrategiesToDefault().catch((err) => {
          logger.error(`Startup migration failed: ${err.message}`);
        });

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

        isConnected = true;
        console.log(
          "✅ All database initializations complete. isConnected is now true.",
        );
      } catch (err) {
        _initPromise = null; // allow a future retry
        logger.fatal(
          "❌ RBAC initialization failed on connection:",
          err.message,
        );
        logger.warn(
          "⚠️ Retries are now allowed for subsequent connectToMongoDB calls.",
        );

        if (
          process.env.NODE_ENV !== "test" &&
          process.env.ALLOW_RBAC_STARTUP_ERRORS !== "true"
        ) {
          process.exit(1);
        }
      }

      return mainConnection;
    } catch (error) {
      _initPromise = null; // allow a future retry
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      throw error;
    }
  })();

  return _initPromise;
};

// Fire-and-forget at module load; connection errors are handled inside connectToMongoDB.
let mainConnectionInstance = mongoose.connection;
connectToMongoDB()
  .then((conn) => {
    if (conn) mainConnectionInstance = conn;
  })
  .catch((err) => {
    logger.error(`Failed to establish MongoDB connection: ${err.message}`);
  });

// Registered once at module scope to avoid duplicate listeners on repeated
// connectToMongoDB() calls.
if (!_processHandlersRegistered) {
  _processHandlersRegistered = true;

  process.on("unhandledRejection", (reason, p) => {
    logger.error("Unhandled Rejection at: Promise", p, "reason:", reason);
  });

  process.on("uncaughtException", (err) => {
    logger.error("There was an uncaught error", err);
  });
}

const getIsConnected = () => isConnected;
const getQueryConnection = () => mainConnectionInstance;
const getCommandConnection = () => mainConnectionInstance;

/**
 * Internal helper — resolves a tenant-specific database from the main connection.
 * Both command and query paths use the same underlying connection; this avoids
 * duplicating the readyState check and model-registration logic.
 */
function _resolveTenantDB(tenantId, modelName, schema, label) {
  const dbName = `${constants.DB_NAME}_${tenantId}`;
  if (mainConnectionInstance && mainConnectionInstance.readyState === 1) {
    const db = mainConnectionInstance.useDb(dbName, { useCache: true });
    try {
      db.model(modelName);
    } catch {
      db.model(modelName, schema);
    }
    return db;
  }
  throw new Error(`${label} database connection not established or not ready`);
}

/**
 * Get a tenant-specific database from command DB (for write operations)
 */
function getCommandTenantDB(tenantId, modelName, schema) {
  return _resolveTenantDB(tenantId, modelName, schema, "Command");
}

/**
 * Get a tenant-specific database from query DB (for read operations)
 */
function getQueryTenantDB(tenantId, modelName, schema) {
  return _resolveTenantDB(tenantId, modelName, schema, "Query");
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
  getIsConnected,
  getQueryConnection,
  getCommandConnection,
};
