const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const { stringify } = require("@utils/common");
const { acquireCronLock } = require("@utils/common/cron-lock.util");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- username-email-sync-job`
);

const TENANT = constants.DEFAULT_TENANT || "airqo";
const BATCH_SIZE = 500;

// Only users whose userName doesn't already match their email are "dirty".
// $expr lets Mongo compare the two fields server-side, so already-aligned
// users are never fetched or written — each run only touches what's left.
const DIRTY_FILTER = {
  email: { $nin: [null, ""] },
  $expr: { $ne: ["$userName", "$email"] },
};

let isJobRunning = false;

const syncUsernamesToEmail = async () => {
  if (isJobRunning) {
    logger.warn("username-email-sync-job already running — skipping tick");
    return;
  }
  isJobRunning = true;

  try {
    const gotLock = await acquireCronLock(TENANT, jobName);
    if (!gotLock) return;

    const dirtyCount = await UserModel(TENANT).countDocuments(DIRTY_FILTER);

    if (dirtyCount === 0) {
      logger.info("username-email-sync-job: all userNames aligned — nothing to do");
      return;
    }

    logger.info(
      `username-email-sync-job: ${dirtyCount} user(s) with mismatched userName — starting sync`
    );

    let totalUpdated = 0;
    let totalConflicts = 0;
    let lastId = null;

    while (true) {
      if (global.isShuttingDown) {
        logger.info(
          `username-email-sync-job: shutdown signal received — stopping after ${totalUpdated} record(s) updated`
        );
        break;
      }

      // Cursor on _id guarantees forward progress every iteration, even for a
      // doc that keeps failing with a duplicate-key conflict — without this,
      // a conflicted doc stays "dirty" forever and the same batch would be
      // re-fetched on every loop, spinning indefinitely.
      const cursorFilter = lastId
        ? { ...DIRTY_FILTER, _id: { $gt: lastId } }
        : DIRTY_FILTER;

      const batch = await UserModel(TENANT)
        .find(cursorFilter)
        .select("_id")
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .lean();

      if (batch.length === 0) break;

      lastId = batch[batch.length - 1]._id;
      const ids = batch.map((doc) => doc._id);

      // Re-check $expr per op (not just _id) so a doc that changed between the
      // find and the write is never blindly overwritten.
      const ops = ids.map((id) => ({
        updateOne: {
          filter: { _id: id, $expr: { $ne: ["$userName", "$email"] } },
          update: [{ $set: { userName: "$email" } }],
        },
      }));

      try {
        const result = await UserModel(TENANT).bulkWrite(ops, {
          ordered: false,
        });
        totalUpdated += result.modifiedCount || 0;
      } catch (bulkError) {
        // With ordered:false, a duplicate-key conflict on one doc (some other
        // user already holds that email string as their userName) doesn't
        // stop the rest of the batch — it's just skipped and logged. Any
        // writeError with a different code is unexpected, so it's rethrown
        // to stop the job rather than being silently swallowed as a conflict.
        const writeErrors = bulkError.writeErrors || [];
        if (writeErrors.length === 0) {
          throw bulkError;
        }

        const unexpected = writeErrors.filter((we) => we.code !== 11000);
        if (unexpected.length > 0) {
          throw bulkError;
        }

        totalUpdated += (bulkError.result && bulkError.result.nModified) || 0;
        totalConflicts += writeErrors.length;
        writeErrors.forEach((writeError) => {
          const failedId = ids[writeError.index];
          // Log only the _id and code — the driver's errmsg embeds the
          // actual duplicate value (here, an email address), which must not
          // land in logs.
          logger.warn(
            `username-email-sync-job: skipped user _id=${failedId} — userName/email conflict (code ${writeError.code})`
          );
        });
      }

      logger.debug(`Batch done: ${batch.length} record(s) processed`);
    }

    logger.info(
      `username-email-sync-job: complete — ${totalUpdated} updated, ${totalConflicts} skipped due to conflicts`
    );
  } catch (error) {
    logger.error(`username-email-sync-job error --- ${stringify(error)}`);
  } finally {
    isJobRunning = false;
  }
};

// Run once daily at 04:00 Nairobi time.
const schedule = "0 4 * * *";
const jobName = "username-email-sync-job";

global.cronJobs = global.cronJobs || {};
global.cronJobs[jobName] = cron.schedule(schedule, syncUsernamesToEmail, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

module.exports = { syncUsernamesToEmail };
