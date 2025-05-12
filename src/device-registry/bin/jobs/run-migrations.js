// bin/jobs/run-migrations.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- migration-runner`);

// Import all migrations
const networkStatusMigration = require("@migrations/network-status-indexes");

async function runStartupMigrations() {
  try {
    // Get list of tenants from constants
    const tenants = constants.TENANTS || ["airqo"];

    // Use executeMigration instead of runMigration for consistency
    // This handles tenant loading internally
    await networkStatusMigration.executeMigration();

    // Add more migrations here as needed in the future
  } catch (error) {
    logger.error(`🐛🐛 Error running startup migrations: ${error.message}`);
    // Don't throw error to prevent server from crashing
    // Migrations can be run manually later
  }
}

module.exports = runStartupMigrations;
