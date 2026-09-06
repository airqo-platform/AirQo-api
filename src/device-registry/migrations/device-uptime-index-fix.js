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
// This service only ever runs against one tenant — the real multi-tenant
// design was abandoned; "airqo" is the database's permanent identity, not a
// placeholder. No tenant loop/array here on purpose (see project memory on
// tenant handling) — a single direct run against the default tenant.
const TENANT = constants.DEFAULT_TENANT || "airqo";

async function checkMigrationStatus() {
  try {
    const tracker = await MigrationTrackerModel(TENANT).findOne({
      name: MIGRATION_NAME,
      tenant: TENANT,
    });

    if (!tracker) {
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
      status,
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

async function fixIndexes() {
  try {
    const tenantDB = getRawTenantDB(TENANT);
    const collectionName = "device_uptimes";

    const collections = await tenantDB.db
      .listCollections({ name: collectionName })
      .toArray();
    if (collections.length === 0) {
      logger.info(
        `device_uptimes collection does not exist yet; nothing to fix.`
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

    // Stale means "any standalone created_at index that isn't exactly the
    // TTL we want" — not just a missing expireAfterSeconds. A leftover index
    // created with some other TTL value would conflict with createIndex
    // below just as much as a fully non-TTL one would.
    const staleIndexes = existingIndexes.filter(
      (idx) =>
        isSingleCreatedAtKey(idx) && idx.expireAfterSeconds !== TTL_SECONDS
    );

    for (const staleIndex of staleIndexes) {
      logger.warn(
        `Dropping stale non-TTL created_at index "${staleIndex.name}" on ${collectionName}`
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
      logger.info(`Created correct TTL index on ${collectionName}.created_at`);
    }

    // Re-assert the other indexes this schema expects too, in case the
    // model's own init() never got far enough to create them while stuck.
    await Promise.all([
      collection.createIndex({ device_name: 1, created_at: -1 }),
      collection.createIndex({ channel_id: 1, created_at: -1 }),
      collection.createIndex({ network: 1, created_at: -1 }),
    ]);

    logger.info(`device_uptimes indexes verified`);
  } catch (error) {
    logger.error(
      `🐛🐛 Error fixing device_uptimes indexes: ${error.message}`
    );
    throw error;
  }
}

async function runMigration() {
  try {
    const status = await checkMigrationStatus();
    if (status === "completed") {
      return;
    }

    await updateMigrationStatus("running");
    await fixIndexes();
    await updateMigrationStatus("completed");
  } catch (error) {
    logger.error(`🐛🐛 Migration failed: ${error.message}`);
    await updateMigrationStatus("failed", error);
    throw error;
  }
}

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
