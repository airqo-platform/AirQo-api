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
const RETENTION_DAYS = constants.UNKNOWN_IP_RETENTION_DAYS;
const BATCH_SIZE = 500;

const cleanupUnknownIPs = async () => {
  const tenant = constants.DEFAULT_TENANT || "airqo";

  try {
    logger.info(`${JOB_NAME}: starting cleanup (retention = ${RETENTION_DAYS} days)`);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    let totalDeleted = 0;

    while (true) {
      const batch = await UnknownIPModel(tenant)
        .find({ updatedAt: { $lt: cutoff } })
        .sort({ updatedAt: 1 })
        .limit(BATCH_SIZE)
        .select("_id")
        .lean();

      if (batch.length === 0) break;

      const ids = batch.map((doc) => doc._id);
      const result = await UnknownIPModel(tenant).deleteMany({
        _id: { $in: ids },
        updatedAt: { $lt: cutoff },
      });

      totalDeleted += result.deletedCount;
      logger.info(
        `${JOB_NAME}: deleted batch of ${result.deletedCount} (total so far: ${totalDeleted})`
      );

      if (batch.length < BATCH_SIZE) break;

      // Brief pause between batches to reduce cluster load
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    logger.info(
      `${JOB_NAME}: completed — deleted ${totalDeleted} documents not updated since ${cutoff.toISOString()}`
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
