// migrations/site-location-geospatial-index.js
//
// Backfills the GeoJSON `location` field (see models/Site.js) on sites
// created before it existed, then creates the 2dsphere index it backs.
// Going forward, `location` is set on creation by the Site pre-save hook —
// this migration only needs to run once, for the pre-existing backlog.
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- site-location-geospatial-index-migration`
);
const MigrationTrackerModel = require("@models/MigrationTracker");
const { getRawTenantDB, connectToMongoDB } = require("@config/database");

const MIGRATION_NAME = "site-location-geospatial-index-v1";
const BATCH_SIZE = 500;
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

async function backfillLocations(collection) {
  const filter = {
    latitude: { $type: "number" },
    longitude: { $type: "number" },
    location: { $exists: false },
  };

  let totalBackfilled = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const sites = await collection
      .find(filter, { projection: { _id: 1, latitude: 1, longitude: 1 } })
      .limit(BATCH_SIZE)
      .toArray();

    if (sites.length === 0) {
      break;
    }

    const bulkOps = sites.map((site) => ({
      updateOne: {
        filter: { _id: site._id },
        update: {
          $set: {
            location: {
              type: "Point",
              coordinates: [site.longitude, site.latitude],
            },
          },
        },
      },
    }));

    const result = await collection.bulkWrite(bulkOps, { ordered: false });
    totalBackfilled += result.modifiedCount || 0;

    // Batch fully processed and filter still matches the same count means
    // every remaining match failed to update (shouldn't happen, but avoids
    // an infinite loop if it ever does).
    if (sites.length < BATCH_SIZE) {
      break;
    }
  }

  return totalBackfilled;
}

async function migrateSiteLocations() {
  try {
    const tenantDB = getRawTenantDB(TENANT);
    const collectionName = "sites";

    const collections = await tenantDB.db
      .listCollections({ name: collectionName })
      .toArray();
    if (collections.length === 0) {
      logger.info(`sites collection does not exist yet; nothing to do.`);
      return;
    }

    const collection = tenantDB.db.collection(collectionName);

    const backfilledCount = await backfillLocations(collection);
    if (backfilledCount > 0) {
      logger.info(
        `Backfilled 'location' on ${backfilledCount} site(s) from latitude/longitude.`
      );
    }

    await collection.createIndex(
      { location: "2dsphere" },
      { name: "location_2dsphere" }
    );
    logger.info(`location 2dsphere index verified on ${collectionName}.`);
  } catch (error) {
    logger.error(
      `🐛🐛 Error migrating site locations: ${error.message}`
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
    await migrateSiteLocations();
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
