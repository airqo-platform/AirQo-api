const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- unknown-ip-cleanup-job`
);
const cron = require("node-cron");
const UnknownIPModel = require("@models/UnknownIP");

const JOB_NAME = "unknown-ip-cleanup-job";
// Run every Sunday at 02:00 AM — low-traffic window
const JOB_SCHEDULE = "0 2 * * 0";
const TIMEZONE = "Africa/Nairobi";
const RETENTION_DAYS = 90;

const cleanupUnknownIPs = async () => {
  const tenant = constants.DEFAULT_TENANT || "airqo";

  try {
    logger.info(`${JOB_NAME}: starting cleanup (retention = ${RETENTION_DAYS} days)`);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const result = await UnknownIPModel(tenant).deleteMany({
      updatedAt: { $lt: cutoff },
    });

    logger.info(
      `${JOB_NAME}: deleted ${result.deletedCount} documents not updated since ${cutoff.toISOString()}`
    );
  } catch (error) {
    logger.error(`${JOB_NAME}: error during cleanup — ${error.message}`);
  }
};

global.cronJobs = global.cronJobs || {};

if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
  global.cronJobs[JOB_NAME] = cron.schedule(JOB_SCHEDULE, cleanupUnknownIPs, {
    scheduled: true,
    timezone: TIMEZONE,
  });
}

module.exports = { cleanupUnknownIPs };
