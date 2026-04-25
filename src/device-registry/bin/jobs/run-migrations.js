// bin/jobs/run-migrations.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- migration-runner`);
const SiteModel = require("@models/Site");

// Import all migrations
const networkStatusMigration = require("@migrations/network-status-indexes");

// One-time cleanup: remove geocoding failure tracking fields that were made
// obsolete when the backfill job was simplified to use isOnline + createdAt
// guards instead of per-site permanent exclusion stamps. The $unset is a
// no-op on documents that never had these fields, so this is safe to run on
// every startup — it exits immediately once no dirty documents remain.
async function resetGeocodingExclusionFields() {
  const tenants = Array.isArray(constants.TENANTS)
    ? constants.TENANTS
    : ["airqo"];

  for (const tenant of tenants) {
    try {
      const result = await SiteModel(tenant).collection.updateMany(
        {
          $or: [
            { _geocodingPermanentlyExcluded: { $exists: true } },
            { _geocodingFailedCount: { $exists: true } },
          ],
        },
        {
          $unset: {
            _geocodingPermanentlyExcluded: "",
            _geocodingFailedCount: "",
          },
        },
      );
      if (result.modifiedCount > 0) {
        logger.info(
          `resetGeocodingExclusionFields [${tenant}]: cleared ${result.modifiedCount} site(s)`,
        );
      }
    } catch (error) {
      logger.error(
        `resetGeocodingExclusionFields [${tenant}]: ${error.message}`,
      );
    }
  }
}

async function runStartupMigrations() {
  // Each migration runs in its own try-catch so one failure never blocks the
  // others. networkStatusMigration uses getRawTenantDB (raw driver, not
  // Mongoose-buffered) so it must tolerate a not-yet-connected DB gracefully.
  // resetGeocodingExclusionFields uses SiteModel which IS Mongoose-buffered
  // and will queue correctly regardless of connection timing.
  try {
    await networkStatusMigration.executeMigration();
  } catch (error) {
    logger.error(`🐛🐛 networkStatusMigration failed: ${error.message}`);
  }

  try {
    await resetGeocodingExclusionFields();
  } catch (error) {
    logger.error(`🐛🐛 resetGeocodingExclusionFields failed: ${error.message}`);
  }
}

module.exports = runStartupMigrations;
