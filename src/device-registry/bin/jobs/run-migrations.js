// bin/jobs/run-migrations.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- migration-runner`);
const SiteModel = require("@models/Site");

// Import all migrations
const networkStatusMigration = require("@migrations/network-status-indexes");
const deviceUptimeIndexFixMigration = require("@migrations/device-uptime-index-fix");

// One-time cleanup: remove geocoding failure tracking fields that were made
// obsolete when the backfill job was simplified to use isOnline + createdAt
// guards instead of per-site permanent exclusion stamps. The $unset is a
// no-op on documents that never had these fields, so this is safe to run on
// every startup — it exits immediately once no dirty documents remain.
// Single tenant on purpose — the real multi-tenant design was abandoned;
// "airqo" is the database's permanent identity, not a placeholder. Don't
// reintroduce a `constants.TENANTS` loop here: it defaults to `[]` (truthy,
// so `|| ["airqo"]`-style fallbacks silently no-op) whenever the TENANTS env
// var isn't set, which is exactly how this function's original tenant loop
// went dead in any environment without it explicitly configured.
async function resetGeocodingExclusionFields() {
  const tenant = constants.DEFAULT_TENANT || "airqo";

  try {
    const filter = {
      $or: [
        { _geocodingPermanentlyExcluded: { $exists: true } },
        { _geocodingFailedCount: { $exists: true } },
      ],
    };
    const probe = await SiteModel(tenant).collection.findOne(filter, {
      projection: { _id: 1 },
    });
    if (!probe) return;

    const result = await SiteModel(tenant).collection.updateMany(filter, {
      $unset: {
        _geocodingPermanentlyExcluded: "",
        _geocodingFailedCount: "",
      },
    });
    if (result.modifiedCount > 0) {
      logger.info(
        `resetGeocodingExclusionFields: cleared ${result.modifiedCount} site(s)`,
      );
    }
  } catch (error) {
    logger.error(`resetGeocodingExclusionFields: ${error.message}`);
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
    await deviceUptimeIndexFixMigration.executeMigration();
  } catch (error) {
    logger.error(
      `🐛🐛 deviceUptimeIndexFixMigration failed: ${error.message}`
    );
  }

  try {
    await resetGeocodingExclusionFields();
  } catch (error) {
    logger.error(`🐛🐛 resetGeocodingExclusionFields failed: ${error.message}`);
  }
}

module.exports = runStartupMigrations;
