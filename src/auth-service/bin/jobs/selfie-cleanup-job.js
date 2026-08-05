const cron = require("node-cron");
const cloudinary = require("@config/cloudinary");
const constants = require("@config/constants");
const SelfieModel = require("@models/Selfie");
const log4js = require("log4js");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/selfie-cleanup-job`
);

const RETENTION_DAYS = constants.CLEAN_AIR_FORUM_SELFIE_RETENTION_DAYS;
const BATCH_SIZE = 100;
const TAG = constants.CLEAN_AIR_FORUM_SELFIE_TAG;

const isCloudinaryConfigured =
  !!constants.CLOUD_NAME &&
  !!constants.CLOUDINARY_API_KEY &&
  !!constants.CLOUDINARY_API_SECRET;

const cleanupOldSelfies = async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  if (isCloudinaryConfigured) {
    let deleted = 0;
    let errors = 0;
    let nextCursor;

    try {
      do {
        const listOptions = {
          resource_type: "image",
          max_results: BATCH_SIZE,
          direction: "asc",
        };
        if (nextCursor) listOptions.next_cursor = nextCursor;

        const response = await cloudinary.api.resources_by_tag(
          TAG,
          listOptions
        );

        const stale = (response.resources || []).filter(
          (r) => new Date(r.created_at) < cutoff
        );

        if (stale.length > 0) {
          const publicIds = stale.map((r) => r.public_id);
          try {
            await cloudinary.api.delete_resources(publicIds, {
              resource_type: "image",
            });
            deleted += publicIds.length;
          } catch (deleteError) {
            logger.error(
              `Failed to delete batch of ${publicIds.length} selfies: ${deleteError.message}`
            );
            errors += publicIds.length;
          }
        }

        // If none in this page are stale (oldest-first order), no later
        // pages will be stale either — stop early to avoid unnecessary API
        // calls.
        if (stale.length < response.resources.length) {
          break;
        }

        nextCursor = response.next_cursor;
      } while (nextCursor);

      if (deleted > 0 || errors > 0) {
        logger.info(
          `Selfie Cloudinary cleanup: deleted ${deleted}, errors ${errors}`
        );
      }
    } catch (error) {
      logger.error(`Selfie Cloudinary cleanup error: ${error.message}`);
    }
  } else {
    logger.warn(
      "Cloudinary not configured — skipping selfie Cloudinary cleanup"
    );
  }

  // Mongo-side cleanup runs independently of the Cloudinary step above —
  // both are governed by the same age cutoff, so a stale Mongo record is
  // removed even if its matching Cloudinary asset was already gone or
  // failed to delete.
  try {
    const tenant = constants.DEFAULT_TENANT || "airqo";
    const response = await SelfieModel(tenant).removeMany({
      filter: { createdAt: { $lt: cutoff } },
    });

    if (response.success && response.data.deletedCount > 0) {
      logger.info(
        `Selfie Mongo cleanup: deleted ${response.data.deletedCount} stale record(s)`
      );
    }
  } catch (error) {
    logger.error(`Selfie Mongo cleanup error: ${error.message}`);
  }
};

global.cronJobs = global.cronJobs || {};
const schedule = "30 2 * * *"; // every day at 2:30 AM, after the feedback screenshot cleanup job
const jobName = "selfie-cleanup-job";
global.cronJobs[jobName] = cron.schedule(schedule, cleanupOldSelfies, {
  scheduled: false, // temporarily disabled — selfie feature is currently unused, no cost pressure to prune recent event photos
  timezone: "Africa/Nairobi",
});

module.exports = { cleanupOldSelfies };
