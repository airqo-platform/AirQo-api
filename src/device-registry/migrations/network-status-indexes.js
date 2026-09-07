// migrations/network-status-indexes.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-status-migration`
);
const MigrationTrackerModel = require("@models/MigrationTracker");
const {
  getRawTenantDB, // Use the new function
  connectToMongoDB,
} = require("@config/database");

const MIGRATION_NAME = "network-status-indexes-v1";
// This service only ever runs against one tenant — the real multi-tenant
// design was abandoned; "airqo" is the database's permanent identity, not a
// placeholder. No tenant loop/array here on purpose (see project memory on
// tenant handling — future changes to this file should not reintroduce a
// `constants.TENANTS` loop). Note: `constants.TENANTS` defaults to `[]`
// (falsy-looking but truthy) when unset, not `undefined` — `constants.TENANTS
// || ["airqo"]` silently no-ops instead of falling back, which is exactly the
// kind of bug this single-tenant constant avoids entirely.
const TENANT = constants.DEFAULT_TENANT || "airqo";

async function checkMigrationStatus() {
  try {
    const tracker = await MigrationTrackerModel(TENANT).findOne({
      name: MIGRATION_NAME,
      tenant: TENANT,
    });

    if (!tracker) {
      // Create new migration record
      await MigrationTrackerModel(TENANT).create({
        name: MIGRATION_NAME,
        tenant: TENANT,
        status: "pending",
      });
      return "pending";
    }

    return tracker.status;
  } catch (error) {
    logger.error(`🐛🐛 Error checking migration status: ${error.message}`);
    throw error;
  }
}

async function updateMigrationStatus(status, error = null) {
  try {
    const update = {
      status: status,
      ...(status === "running" && { startedAt: new Date() }),
      ...(status === "completed" && { completedAt: new Date() }),
      ...(error && { error: error.message }),
    };

    await MigrationTrackerModel(TENANT).findOneAndUpdate(
      { name: MIGRATION_NAME, tenant: TENANT },
      update,
      { new: true }
    );
  } catch (error) {
    logger.error(`🐛🐛 Error updating migration status: ${error.message}`);
    throw error;
  }
}

async function createIndexes() {
  try {
    // Use getRawTenantDB to get database access without model registration
    const tenantDB = getRawTenantDB(TENANT);
    const collectionName = "networkstatusalerts";

    // Check if collection exists
    const collections = await tenantDB.db
      .listCollections({ name: collectionName })
      .toArray();

    if (collections.length === 0) {
      return;
    }

    const collection = tenantDB.db.collection(collectionName);

    // Create indexes in parallel for better performance
    const indexPromises = [
      collection.createIndex({ checked_at: -1 }),
      collection.createIndex({ status: 1 }),
      collection.createIndex({ tenant: 1, checked_at: -1 }),
      collection.createIndex({ offline_percentage: 1 }),
      collection.createIndex({ threshold_exceeded: 1 }),
      collection.createIndex({ day_of_week: 1, hour_of_day: 1 }),
      collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: 90 * 24 * 60 * 60 }
      ),
    ];
    await Promise.all(indexPromises);
    logger.info(`Indexes created/ensured`);
  } catch (error) {
    logger.error(`🐛🐛 Error creating indexes: ${error.message}`);
    throw error;
  }
}

async function runMigration() {
  try {
    // Check if migration already completed
    const status = await checkMigrationStatus();

    if (status === "completed") {
      return;
    }

    // Update status to running
    await updateMigrationStatus("running");

    // Create indexes
    await createIndexes();

    // Update status to completed
    await updateMigrationStatus("completed");
  } catch (error) {
    logger.error(`🐛🐛 Migration failed: ${error.message}`);
    await updateMigrationStatus("failed", error);
    throw error;
  }
}

// Manual execution function
async function executeMigration() {
  try {
    await runMigration();
    return true;
  } catch (error) {
    logger.error(`🐛🐛 Migration error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  runMigration,
  executeMigration,
  MIGRATION_NAME,
};

// This is a special case for when the script is run directly via CLI
// It will NOT interfere with the application when imported as a module
if (require.main === module) {
  // Initialize DB connections explicitly. This sets the module-level variables in database.js
  const { commandDB, queryDB } = connectToMongoDB();

  const run = async () => {
    let exitCode = 0;
    try {
      await executeMigration();
      logger.info("Migration completed successfully.");
    } catch (error) {
      logger.error(`🐛🐛 Migration failed with error: ${error.message}`);
      exitCode = 1;
    } finally {
      logger.info("Closing database connections and exiting script.");
      try {
        await Promise.all([
          commandDB && commandDB.close ? commandDB.close() : Promise.resolve(),
          queryDB && queryDB.close ? queryDB.close() : Promise.resolve(),
        ]);
        logger.info("Database connections closed.");
      } catch (closeError) {
        logger.error(`Error closing connections: ${closeError.message}`);
        exitCode = 1;
      }
      process.exit(exitCode);
    }
  };

  // Wait for the database connection to be ready before running the migration
  if (queryDB.readyState === 1) {
    logger.info("MongoDB connection is ready. Running migration...");
    run();
  } else {
    logger.info("Waiting for MongoDB connection to be ready...");
    queryDB.once("open", () => {
      logger.info("MongoDB connection opened. Running migration...");
      run();
    });
    queryDB.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err.message}. Exiting.`);
      process.exit(1);
    });
  }
}
