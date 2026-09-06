// migrations/device-uptime-index-fix.js
//
// Fixes a stale index on device_uptimes.created_at left over from before the
// TTL index was added correctly (see models/DeviceUptime.js). MongoDB will
// not create a new index that shares a key pattern with an existing one that
// has different options — if an earlier deploy ever got as far as creating a
// plain, non-TTL {created_at:1} index, every later attempt by Mongoose to
// auto-create the current {created_at:1, expireAfterSeconds:...} index keeps
// failing with an IndexOptionsConflict. Because Mongoose gates ALL buffered
// operations behind Model.init() (which includes index sync), a stuck index
// sync makes every operation against this model — reads and writes alike —
// fail with "buffering timed out", regardless of what the operation itself
// is doing. This migration finds and drops any conflicting created_at index
// and creates the correct one directly via the raw driver, so it isn't
// itself blocked by whatever is currently stuck on the Mongoose-level model.
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device-uptime-index-fix-migration`
);
const MigrationTrackerModel = require("@models/MigrationTracker");
const { getRawTenantDB, connectToMongoDB } = require("@config/database");

const MIGRATION_NAME = "device-uptime-index-fix-v1";
const TTL_SECONDS = 90 * 24 * 60 * 60;

async function checkMigrationStatus(tenant) {
  try {
    const tracker = await MigrationTrackerModel(tenant).findOne({
      name: MIGRATION_NAME,
      tenant,
    });

    if (!tracker) {
      await MigrationTrackerModel(tenant).create({
        name: MIGRATION_NAME,
        tenant,
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
      status,
      ...(status === "running" && { startedAt: new Date() }),
      ...(status === "completed" && { completedAt: new Date() }),
      ...(error && { error: error.message }),
    };

    await MigrationTrackerModel(tenant).findOneAndUpdate(
      { name: MIGRATION_NAME, tenant },
      update,
      { new: true }
    );
  } catch (error) {
    logger.error(`🐛🐛 Error updating migration status: ${error.message}`);
    throw error;
  }
}

async function fixIndexesForTenant(tenant) {
  try {
    const tenantDB = getRawTenantDB(tenant);
    const collectionName = "device_uptimes";

    const collections = await tenantDB.db
      .listCollections({ name: collectionName })
      .toArray();
    if (collections.length === 0) {
      logger.info(
        `device_uptimes collection does not exist yet for tenant ${tenant}; nothing to fix.`
      );
      return;
    }

    const collection = tenantDB.db.collection(collectionName);
    const existingIndexes = await collection.indexes();

    // Only target the standalone {created_at:1} index — never touch the
    // compound indexes (device_name+created_at, channel_id+created_at,
    // network+created_at), which have a different key pattern and are not
    // part of this conflict.
    const isSingleCreatedAtKey = (idx) => {
      const keys = Object.keys(idx.key);
      return keys.length === 1 && keys[0] === "created_at";
    };

    const staleIndexes = existingIndexes.filter(
      (idx) => isSingleCreatedAtKey(idx) && idx.expireAfterSeconds === undefined
    );

    for (const staleIndex of staleIndexes) {
      logger.warn(
        `Dropping stale non-TTL created_at index "${staleIndex.name}" on ${collectionName} (tenant ${tenant})`
      );
      await collection.dropIndex(staleIndex.name);
    }

    const alreadyCorrect = existingIndexes.some(
      (idx) =>
        isSingleCreatedAtKey(idx) && idx.expireAfterSeconds === TTL_SECONDS
    );

    if (!alreadyCorrect) {
      await collection.createIndex(
        { created_at: 1 },
        { expireAfterSeconds: TTL_SECONDS }
      );
      logger.info(
        `Created correct TTL index on ${collectionName}.created_at (tenant ${tenant})`
      );
    }

    // Re-assert the other indexes this schema expects too, in case the
    // model's own init() never got far enough to create them while stuck.
    await Promise.all([
      collection.createIndex({ device_name: 1, created_at: -1 }),
      collection.createIndex({ channel_id: 1, created_at: -1 }),
      collection.createIndex({ network: 1, created_at: -1 }),
    ]);

    logger.info(`device_uptimes indexes verified for tenant ${tenant}`);
  } catch (error) {
    logger.error(
      `🐛🐛 Error fixing device_uptimes indexes for tenant ${tenant}: ${error.message}`
    );
    throw error;
  }
}

async function runMigration(tenants = ["airqo"]) {
  for (const tenant of tenants) {
    try {
      const status = await checkMigrationStatus(tenant);
      if (status === "completed") {
        continue;
      }

      await updateMigrationStatus(tenant, "running");
      await fixIndexesForTenant(tenant);
      await updateMigrationStatus(tenant, "completed");
    } catch (error) {
      logger.error(
        `🐛🐛 Migration failed for tenant ${tenant}: ${error.message}`
      );
      await updateMigrationStatus(tenant, "failed", error);
    }
  }
}

async function executeMigration() {
  try {
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

// Special case for running this script directly via CLI — does not
// interfere with the application when imported as a module.
if (require.main === module) {
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
