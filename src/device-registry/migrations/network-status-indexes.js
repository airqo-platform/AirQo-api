// migrations/network-status-indexes.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-status-migration`
);
const MigrationTrackerModel = require("@models/MigrationTracker");
const {
  getRawTenantDB, // Use the new function
  queryMongoDB,
  commandMongoDB,
} = require("@config/database");

const MIGRATION_NAME = "network-status-indexes-v1";

async function checkMigrationStatus(tenant) {
  try {
    const tracker = await MigrationTrackerModel(tenant).findOne({
      name: MIGRATION_NAME,
      tenant: tenant,
    });

    if (!tracker) {
      // Create new migration record
      await MigrationTrackerModel(tenant).create({
        name: MIGRATION_NAME,
        tenant: tenant,
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

async function updateMigrationStatus(tenant, status, error = null) {
  try {
    const update = {
      status: status,
      ...(status === "running" && { startedAt: new Date() }),
      ...(status === "completed" && { completedAt: new Date() }),
      ...(error && { error: error.message }),
    };

    await MigrationTrackerModel(tenant).findOneAndUpdate(
      { name: MIGRATION_NAME, tenant: tenant },
      update,
      { new: true }
    );
  } catch (error) {
    logger.error(`🐛🐛 Error updating migration status: ${error.message}`);
    throw error;
  }
}

async function createIndexesForTenant(tenant) {
  try {
    // Use getRawTenantDB to get database access without model registration
    const tenantDB = getRawTenantDB(tenant);
    const collectionName = "networkstatusalerts";

    // Check if collection exists
    const collections = await tenantDB.db
      .listCollections({ name: collectionName })
      .toArray();

    if (collections.length === 0) {
      return;
    }

    const collection = tenantDB.db.collection(collectionName);

    // Create indexes - these will be no-ops if indexes already exist
    await collection.createIndex({ checked_at: -1 });
    await collection.createIndex({ status: 1 });
    await collection.createIndex({ tenant: 1, checked_at: -1 });
    await collection.createIndex({ offline_percentage: 1 });
    await collection.createIndex({ threshold_exceeded: 1 });
    await collection.createIndex({ day_of_week: 1, hour_of_day: 1 });

    // Create TTL index
    await collection.createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 90 * 24 * 60 * 60 }
    );
  } catch (error) {
    logger.error(
      `🐛🐛 Error creating indexes for tenant ${tenant}: ${error.message}`
    );
    throw error;
  }
}

async function runMigration(tenants = ["airqo"]) {
  for (const tenant of tenants) {
    try {
      // Check if migration already completed
      const status = await checkMigrationStatus(tenant);

      if (status === "completed") {
        continue;
      }

      // Update status to running
      await updateMigrationStatus(tenant, "running");

      // Create indexes
      await createIndexesForTenant(tenant);

      // Update status to completed
      await updateMigrationStatus(tenant, "completed");
    } catch (error) {
      logger.error(
        `🐛🐛 Migration failed for tenant ${tenant}: ${error.message}`
      );
      await updateMigrationStatus(tenant, "failed", error);
    }
  }
}

// Manual execution function
async function executeMigration() {
  try {
    // You can customize the list of tenants here
    const tenants = constants.TENANTS || ["airqo"];
    await runMigration(tenants);
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
  const run = async () => {
    try {
      await executeMigration();
      logger.info("Migration completed successfully.");
    } catch (error) {
      logger.error(`🐛🐛 Migration failed with error: ${error.message}`);
    } finally {
      logger.info("Closing database connections and exiting script.");
      try {
        await Promise.all([commandMongoDB.close(), queryMongoDB.close()]);
        logger.info("Database connections closed.");
      } catch (closeError) {
        logger.error(`Error closing connections: ${closeError.message}`);
      }
      process.exit(0);
    }
  };

  // Wait for the database connection to be ready before running the migration
  if (queryMongoDB.readyState === 1) {
    logger.info("MongoDB connection is ready. Running migration...");
    run();
  } else {
    logger.info("Waiting for MongoDB connection to be ready...");
    queryMongoDB.on("open", () => {
      logger.info("MongoDB connection opened. Running migration...");
      run();
    });
    queryMongoDB.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err.message}. Exiting.`);
      process.exit(1);
    });
  }
}
