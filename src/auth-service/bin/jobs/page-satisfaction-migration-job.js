const cron = require("node-cron");
const constants = require("@config/constants");
const log4js = require("log4js");
const { stringify } = require("@utils/common");
const { acquireCronLock } = require("@utils/common/cron-lock.util");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- page-satisfaction-migration-job`,
);

const TENANT = constants.DEFAULT_TENANT || "airqo";
const BATCH_SIZE = 200;
const jobName = "page-satisfaction-migration-job";

// Page-satisfaction ratings are no longer stored as individual Feedback items.
// This job folds any legacy ones into the page_satisfaction_daily counters and
// deletes them. Each item is counted and deleted independently:
//  - recordLegacy() is idempotent per item id, so a crash between counting and
//    deleting never double-counts on the next run;
//  - an item is deleted only after its count is confirmed.
// Once no legacy items remain, every run is a single countDocuments no-op.
//
// Items an admin has worked on (reply, internal note, assignee or watcher) are
// left in place untouched so that work is not lost; admins can archive them.
// A status change alone is not protected — clearing resolved/archived ratings
// out of the feedback list is the point of this migration.
const NO_ADMIN_CONTENT = {
  "replies.0": { $exists: false },
  "watchers.0": { $exists: false },
  assignedTo: null,
  adminNotes: { $in: [null, ""] },
};
const LEGACY_FILTER = {
  tenant: TENANT,
  category: "page_satisfaction",
  ...NO_ADMIN_CONTENT,
};

let isJobRunning = false;

const migratePageSatisfactionFeedback = async () => {
  if (isJobRunning) {
    logger.warn(`${jobName} already running — skipping tick`);
    return;
  }
  isJobRunning = true;

  try {
    // Require models here (not at module load) so the DB connection is ready.
    const FeedbackModel = require("@models/Feedback");
    const PageSatisfactionDailyModel = require("@models/PageSatisfactionDaily");

    const legacyCount = await FeedbackModel(TENANT).countDocuments(
      LEGACY_FILTER,
    );
    if (legacyCount === 0) {
      logger.info(`${jobName}: no legacy page-satisfaction items — nothing to do`);
      return;
    }

    const gotLock = await acquireCronLock(TENANT, jobName);
    if (!gotLock) return;

    logger.info(`${jobName}: ${legacyCount} legacy item(s) found — migrating`);

    let migrated = 0;
    let alreadyCounted = 0;
    let failed = 0;
    const failedIds = new Set();

    while (true) {
      if (global.isShuttingDown) {
        logger.info(`${jobName}: shutdown signal received — stopping`);
        break;
      }

      const batch = await FeedbackModel(TENANT)
        .find({ ...LEGACY_FILTER, _id: { $nin: [...failedIds] } })
        .select("_id subject rating app platform message screenshot_url createdAt")
        .limit(BATCH_SIZE)
        .lean();

      if (batch.length === 0) break;

      const countedIds = [];
      for (const item of batch) {
        const result = await PageSatisfactionDailyModel(TENANT).recordLegacy({
          sourceId: item._id,
          tenant: TENANT,
          page: PageSatisfactionDailyModel.pageFromSubject(item.subject),
          app: item.app,
          platform: item.platform,
          rating: item.rating,
          hasMessage: Boolean(item.message && item.message.trim()),
          hasScreenshot: Boolean(item.screenshot_url),
          at: item.createdAt ? new Date(item.createdAt) : new Date(),
        });
        if (result.success) {
          countedIds.push(item._id);
          if (result.alreadyCounted) alreadyCounted += 1;
        } else {
          failedIds.add(item._id);
          failed += 1;
        }
      }

      if (countedIds.length > 0) {
        // Re-apply the admin-content guard so an item an admin replied to or
        // annotated after this batch was read is kept rather than deleted.
        const deleted = await FeedbackModel(TENANT).deleteMany({
          _id: { $in: countedIds },
          ...LEGACY_FILTER,
        });
        migrated += deleted.deletedCount || 0;
      }
    }

    logger.info(
      `${jobName}: complete — ${migrated} item(s) migrated and deleted` +
        (alreadyCounted ? ` (${alreadyCounted} were already counted)` : "") +
        (failed ? `, ${failed} failed and were left in place for the next run` : ""),
    );
  } catch (error) {
    logger.error(`${jobName} error --- ${stringify(error)}`);
  } finally {
    isJobRunning = false;
  }
};

// Once a day at 03:00 Nairobi time.
const schedule = "0 3 * * *";

global.cronJobs = global.cronJobs || {};
global.cronJobs[jobName] = cron.schedule(schedule, migratePageSatisfactionFeedback, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

module.exports = { migratePageSatisfactionFeedback };
