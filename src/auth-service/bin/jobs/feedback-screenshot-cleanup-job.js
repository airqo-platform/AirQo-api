const cron = require("node-cron");
const cloudinary = require("@config/cloudinary");
const constants = require("@config/constants");
const log4js = require("log4js");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/feedback-screenshot-cleanup-job`,
);

const RETENTION_DAYS = 30;
const BATCH_SIZE = 100;
const TAG = constants.FEEDBACK_SCREENSHOT_TAG;

const isCloudinaryConfigured =
  !!constants.CLOUD_NAME &&
  !!constants.CLOUDINARY_API_KEY &&
  !!constants.CLOUDINARY_API_SECRET;

const cleanupOldFeedbackScreenshots = async () => {
  if (!isCloudinaryConfigured) {
    logger.warn(
      "Cloudinary not configured — skipping feedback screenshot cleanup job",
    );
    return;
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

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
        listOptions,
      );

      const stale = (response.resources || []).filter(
        (r) => new Date(r.created_at) < cutoff,
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
            `Failed to delete batch of ${publicIds.length} screenshots: ${deleteError.message}`,
          );
          errors += publicIds.length;
        }
      }

      // If none in this page are stale (oldest-first order), no later pages
      // will be stale either — stop early to avoid unnecessary API calls.
      if (stale.length < response.resources.length) {
        break;
      }

      nextCursor = response.next_cursor;
    } while (nextCursor);

    if (deleted > 0 || errors > 0) {
      logger.info(
        `Feedback screenshot cleanup: deleted ${deleted}, errors ${errors}`,
      );
    }
  } catch (error) {
    logger.error(`Feedback screenshot cleanup error: ${error.message}`);
  }
};

global.cronJobs = global.cronJobs || {};
const schedule = "0 2 * * *"; // every day at 2 AM
const jobName = "feedback-screenshot-cleanup-job";
global.cronJobs[jobName] = cron.schedule(
  schedule,
  cleanupOldFeedbackScreenshots,
  { scheduled: true, timezone: "Africa/Nairobi" },
);

module.exports = { cleanupOldFeedbackScreenshots };
