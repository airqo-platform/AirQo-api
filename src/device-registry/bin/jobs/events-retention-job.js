"use strict";
/**
 * events-retention-job.js
 *
 * Runs once a day at 03:00 local time.
 *
 * Deletes Event documents whose `first` timestamp is older than
 * EVENTS_RETENTION_DAYS (default 90 days).  This is safe because:
 *
 *  • store-readings-job already rejects incoming readings older than 30 days,
 *    so no new data can land in the purge window.
 *  • The API default query window is 3 days; the historical-data threshold is
 *    7 days.  Nothing in the product queries data older than a few weeks, so
 *    removing 90-day-old documents has zero impact on live traffic.
 *  • Reading documents have their own 14-day TTL; this job only touches the
 *    aggregated Event collection.
 *
 * Design principles (same as device-metadata-cleanup-job):
 *  • Cursor-based pagination (_id > lastSeenId) keeps memory O(1).
 *  • Each loop reads only _id values then issues a targeted deleteMany.
 *  • Distributed lock (JobLock) prevents overlapping runs across pods.
 *  • Lock is refreshed every 10 min while work is in progress.
 *  • Dry-run mode (EVENTS_RETENTION_DRY_RUN=true) logs without deleting.
 */

const EventModel = require("@models/Event");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const cron = require("node-cron");
const log4js = require("log4js");
const os = require("os");
const { getSchedule } = require("@utils/common");
const moment = require("moment-timezone");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- events-retention-job`
);

// ── Configuration ─────────────────────────────────────────────────────────────

const JOB_NAME = "events-retention-job";
// Once a day at 03:00 — offset from device-metadata-cleanup-job (02:00/10:00/18:00)
const JOB_SCHEDULE = getSchedule("0 3 * * *", constants.ENVIRONMENT);
const TIMEZONE = constants.TIMEZONE || moment.tz.guess();
const POD_ID = process.env.HOSTNAME || os.hostname();
const LOCK_TTL_SECONDS = 60 * 60;           // 1 h initial grant (could be a large first run)
const LOCK_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // refresh every 10 min
const BATCH_SIZE = 500;                      // _ids fetched per DB round-trip
const INTER_BATCH_DELAY_MS = 100;            // breathing room between batches
const DRY_RUN = process.env.EVENTS_RETENTION_DRY_RUN === "true";

const RETENTION_DAYS =
  Number.isFinite(constants.EVENTS_RETENTION_DAYS) && constants.EVENTS_RETENTION_DAYS > 0
    ? constants.EVENTS_RETENTION_DAYS
    : 90;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Distributed lock helpers (identical pattern to device-metadata-cleanup-job) ──

const acquireLock = async (tenant) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  try {
    const result = await JobLockModel(tenant).findOneAndUpdate(
      {
        jobName: JOB_NAME,
        $or: [
          { expiresAt: { $lte: now } },
          { expiresAt: { $exists: false } },
          { acquiredBy: POD_ID },
        ],
      },
      {
        $set: { acquiredBy: POD_ID, acquiredAt: now, expiresAt },
        $setOnInsert: { jobName: JOB_NAME },
      },
      { upsert: true, new: true, rawResult: false }
    );
    return result && result.acquiredBy === POD_ID;
  } catch (error) {
    if (error.code === 11000) return false;
    logger.error(`[${POD_ID}] Lock acquisition error: ${error.message}`);
    return false;
  }
};

const refreshLock = async (tenant) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  try {
    const result = await JobLockModel(tenant).findOneAndUpdate(
      { jobName: JOB_NAME, acquiredBy: POD_ID },
      { $set: { expiresAt } },
      { new: true }
    );
    return !!result;
  } catch (error) {
    logger.error(`[${POD_ID}] Lock refresh error: ${error.message}`);
    return false;
  }
};

const releaseLock = async (tenant) => {
  try {
    await JobLockModel(tenant).findOneAndDelete({
      jobName: JOB_NAME,
      acquiredBy: POD_ID,
    });
  } catch (error) {
    logger.error(`[${POD_ID}] Lock release error: ${error.message}`);
  }
};

// ── Main purge function ────────────────────────────────────────────────────────

const runRetention = async (tenant = "airqo") => {
  if (global.isShuttingDown) return;

  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logger.info(
      `[${POD_ID}] ${JOB_NAME}: could not acquire lock — another pod is running it.`
    );
    return;
  }

  const abortSignal = { isAborted: false };

  const refreshTimer = setInterval(async () => {
    const refreshed = await refreshLock(tenant);
    if (!refreshed) {
      logger.error(
        `[${POD_ID}] ${JOB_NAME}: lock refresh failed — aborting to prevent overlapping runs.`
      );
      abortSignal.isAborted = true;
    }
  }, LOCK_REFRESH_INTERVAL_MS);

  const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const startedAt = Date.now();

  logger.info(
    `[${POD_ID}] ${JOB_NAME}: starting${DRY_RUN ? " [DRY RUN]" : ""}. ` +
    `Purging events where first < ${cutoffDate.toISOString()} (>${RETENTION_DAYS} days old).`
  );

  try {
    const filter = { first: { $lt: cutoffDate } };

    const total = await EventModel(tenant).countDocuments(filter);
    if (total === 0) {
      logger.info(`[${POD_ID}] ${JOB_NAME}: no stale event documents found — nothing to purge.`);
      return;
    }

    logger.info(
      `[${POD_ID}] ${JOB_NAME}: ${total} stale event document(s) found.${DRY_RUN ? " [DRY RUN — skipping deletes]" : ""}`
    );

    if (DRY_RUN) {
      // In dry-run mode report the count but do not delete anything.
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      logger.info(`[${POD_ID}] ${JOB_NAME}: [DRY RUN] complete in ${elapsed}s. Would delete ${total} document(s).`);
      return;
    }

    let lastSeenId = null;
    let totalDeleted = 0;

    while (true) {
      if (abortSignal.isAborted || global.isShuttingDown) {
        logger.warn(`[${POD_ID}] ${JOB_NAME}: aborting — lock was lost or server is shutting down.`);
        break;
      }

      const cursorFilter = lastSeenId
        ? { ...filter, _id: { $gt: lastSeenId } }
        : filter;

      // Fetch only _id values to keep memory O(1)
      const batch = await EventModel(tenant)
        .find(cursorFilter)
        .select("_id")
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .lean();

      if (batch.length === 0) break;

      const ids = batch.map((d) => d._id);
      lastSeenId = ids[ids.length - 1];

      const result = await EventModel(tenant).collection.deleteMany({
        _id: { $in: ids },
        first: { $lt: cutoffDate }, // re-check to guard against documents updated between read and write
      });

      totalDeleted += result.deletedCount;
      logger.info(
        `[${POD_ID}] ${JOB_NAME}: batch of ${ids.length} — deleted ${result.deletedCount}.`
      );

      await sleep(INTER_BATCH_DELAY_MS);
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    logger.info(
      `[${POD_ID}] ${JOB_NAME}: done in ${elapsed}s. Total deleted: ${totalDeleted}.`
    );
  } catch (error) {
    logger.error(`[${POD_ID}] ${JOB_NAME} error: ${error.message}`);
  } finally {
    clearInterval(refreshTimer);
    await releaseLock(tenant);
  }
};

// ── Schedule ──────────────────────────────────────────────────────────────────

let currentJobPromise = null;

const jobWrapper = async () => {
  if (currentJobPromise) {
    logger.warn(
      `[${POD_ID}] ${JOB_NAME}: previous run still in progress — skipping this tick.`
    );
    return;
  }
  currentJobPromise = runRetention("airqo").finally(() => {
    currentJobPromise = null;
  });
  await currentJobPromise;
};

const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
  scheduled: true,
  timezone: TIMEZONE,
});

if (!global.cronJobs) global.cronJobs = {};
global.cronJobs[JOB_NAME] = {
  job: cronJobInstance,
  schedule: JOB_SCHEDULE,
  description: `Purges Event documents older than ${RETENTION_DAYS} days, once daily at 03:00`,
};

logger.info(
  `[${POD_ID}] ${JOB_NAME}: scheduled (${JOB_SCHEDULE}, tz=${TIMEZONE}, retentionDays=${RETENTION_DAYS})${DRY_RUN ? " [DRY RUN MODE]" : ""}.`
);

module.exports = runRetention;
