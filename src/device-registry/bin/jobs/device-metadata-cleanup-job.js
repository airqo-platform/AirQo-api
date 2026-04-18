"use strict";
/**
 * device-metadata-cleanup-job.js
 *
 * Runs three times a day (02:00, 10:00, 18:00 local time).
 *
 * Executes four sequential passes to heal bad device metadata that slipped in
 * before lifecycle-field protection was in place:
 *
 *  Pass 1 – backfill_static
 *    Deployed devices that have a site_id but no deployment_type.
 *    Action: set deployment_type="static", mobility=false.
 *
 *  Pass 2 – backfill_mobile
 *    Deployed devices that have a grid_id but no deployment_type.
 *    Action: set deployment_type="mobile", mobility=true, unset site_id
 *    (mirrors the pre-save hook that clears site_id for mobile devices).
 *
 *  Pass 3 – fix_static_mobility
 *    Devices with deployment_type="static" but mobility=true.
 *    Action: set mobility=false.
 *
 *  Pass 4 – fix_mobile_mobility
 *    Devices with deployment_type="mobile" but mobility=false.
 *    Action: set mobility=true.
 *
 * Design principles
 * -----------------
 * • Cursor-based pagination (_id > lastSeenId) keeps memory usage O(1)
 *   regardless of fleet size.  Each DB round-trip fetches at most BATCH_SIZE
 *   _ids, then issues a targeted updateMany — no full documents are loaded.
 * • The write predicate merges the original pass filter with the _id set so
 *   documents that changed between read and write are not incorrectly patched.
 * • Mongoose middleware is bypassed (collection.updateMany) so the pre-save
 *   hook's mobility↔deployment_type sync does not re-run and produce
 *   redundant writes.
 * • The distributed lock (JobLock) is periodically refreshed while work is
 *   ongoing. If a refresh fails the run aborts immediately so another pod
 *   cannot start an overlapping run.
 * • Dry-run mode (DEVICE_METADATA_CLEANUP_DRY_RUN=true) logs what would
 *   change without writing anything — safe to enable in production for audits.
 */

const DeviceModel = require("@models/Device");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const cron = require("node-cron");
const log4js = require("log4js");
const os = require("os");
const { getSchedule } = require("@utils/common");
const moment = require("moment-timezone");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device-metadata-cleanup-job`
);

// ── Configuration ─────────────────────────────────────────────────────────────

const JOB_NAME = "device-metadata-cleanup-job";
// Three times a day: 02:00, 10:00, 18:00
const JOB_SCHEDULE = getSchedule("0 2,10,18 * * *", constants.ENVIRONMENT);
const TIMEZONE = constants.TIMEZONE || moment.tz.guess();
const POD_ID = process.env.HOSTNAME || os.hostname();
const LOCK_TTL_SECONDS = 30 * 60;        // 30 min initial grant
const LOCK_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // refresh every 10 min
const BATCH_SIZE = 500;                  // IDs fetched per DB round-trip
const INTER_BATCH_DELAY_MS = 50;         // breathing room between batches
const DRY_RUN = process.env.DEVICE_METADATA_CLEANUP_DRY_RUN === "true";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Distributed lock helpers ───────────────────────────────────────────────────

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
          { acquiredBy: POD_ID }, // same pod can reclaim its own lock after restart
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
    if (error.code === 11000) return false; // Another pod beat us to it
    logger.error(`[${POD_ID}] Lock acquisition error: ${error.message}`);
    return false;
  }
};

/**
 * Extends the lock TTL from now. Returns true on success, false if the lock
 * was lost (another pod took it or it expired). The caller must abort if false.
 */
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

// ── Cursor-based pass runner ───────────────────────────────────────────────────

/**
 * Runs a single correction pass.
 *
 * @param {string}   tenant       - Tenant key (e.g. "airqo")
 * @param {string}   passName     - Human-readable label for logs
 * @param {object}   filter       - MongoDB match filter for dirty documents
 * @param {object}   updateOp     - Raw MongoDB update operator ($set / $unset)
 * @param {{ isAborted: boolean }} abortSignal - Set .isAborted=true to halt mid-pass
 * @returns {Promise<number>} Count of modified documents
 */
const runPass = async (tenant, passName, filter, updateOp, abortSignal) => {
  const collection = DeviceModel(tenant).collection;

  // Quick pre-check — avoid acquiring a batch cursor when there's nothing to do
  const total = await DeviceModel(tenant).countDocuments(filter);
  if (total === 0) {
    logger.info(`[${POD_ID}] ${passName}: nothing to fix — skipping.`);
    return 0;
  }

  logger.info(
    `[${POD_ID}] ${passName}: ${total} document(s) need correction.${DRY_RUN ? " [DRY RUN]" : ""}`
  );

  let lastSeenId = null;
  let totalModified = 0;

  while (true) {
    if (abortSignal.isAborted) {
      logger.warn(`[${POD_ID}] ${passName}: aborting — lock was lost.`);
      break;
    }

    const cursorFilter = lastSeenId
      ? { ...filter, _id: { $gt: lastSeenId } }
      : filter;

    // Fetch only _id values — keeps this loop O(1) memory
    const batch = await DeviceModel(tenant)
      .find(cursorFilter)
      .select("_id")
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;

    const ids = batch.map((d) => d._id);
    lastSeenId = ids[ids.length - 1];

    if (DRY_RUN) {
      logger.info(
        `[${POD_ID}] ${passName} [DRY RUN]: would apply ${JSON.stringify(
          updateOp
        )} to ${ids.length} device(s).`
      );
      totalModified += ids.length;
    } else {
      // Merge the original pass filter with the id set so documents that
      // changed between the read and this write are not incorrectly patched.
      const writeFilter = { ...filter, _id: { $in: ids } };
      const result = await collection.updateMany(writeFilter, updateOp);
      totalModified += result.modifiedCount;
      logger.info(
        `[${POD_ID}] ${passName}: batch of ${ids.length} — modified ${result.modifiedCount}.`
      );
    }

    await sleep(INTER_BATCH_DELAY_MS);
  }

  logger.info(
    `[${POD_ID}] ${passName}: done. Total ${DRY_RUN ? "would modify" : "modified"}: ${totalModified}.`
  );
  return totalModified;
};

// ── Main job function ──────────────────────────────────────────────────────────

const runCleanup = async (tenant = "airqo") => {
  if (global.isShuttingDown) return;

  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logger.info(
      `[${POD_ID}] ${JOB_NAME}: could not acquire lock — another pod is running it.`
    );
    return;
  }

  // Shared abort signal — set to true if a lock refresh fails so all passes
  // bail out immediately instead of writing under a lost lock.
  const abortSignal = { isAborted: false };

  // Periodically refresh the lock TTL while passes are running.
  const refreshTimer = setInterval(async () => {
    const refreshed = await refreshLock(tenant);
    if (!refreshed) {
      logger.error(
        `[${POD_ID}] ${JOB_NAME}: lock refresh failed — aborting to prevent overlapping runs.`
      );
      abortSignal.isAborted = true;
    }
  }, LOCK_REFRESH_INTERVAL_MS);

  const startedAt = Date.now();
  logger.info(`[${POD_ID}] ${JOB_NAME}: starting${DRY_RUN ? " [DRY RUN]" : ""}.`);

  try {
    // ── Pass 1: Backfill deployment_type="static" from site_id ───────────────
    // Devices that are deployed at a site but were created before deployment_type
    // was introduced (or had it incorrectly cleared).  Uses the {status,site_id}
    // compound index.
    await runPass(
      tenant,
      "pass1/backfill_static",
      {
        status: "deployed",
        deployment_type: { $exists: false },
        site_id: { $exists: true, $ne: null },
        grid_id: { $in: [null, undefined] },
      },
      { $set: { deployment_type: "static", mobility: false } },
      abortSignal
    );

    if (abortSignal.isAborted || global.isShuttingDown) return;

    // ── Pass 2: Backfill deployment_type="mobile" from grid_id ───────────────
    // Grid-assigned deployed devices without an explicit deployment_type.
    // Also unsets site_id to mirror the pre-save hook that clears it for
    // mobile devices, preventing stale site_id values from persisting.
    await runPass(
      tenant,
      "pass2/backfill_mobile",
      {
        status: "deployed",
        deployment_type: { $exists: false },
        grid_id: { $exists: true, $ne: null },
      },
      {
        $set: { deployment_type: "mobile", mobility: true },
        $unset: { site_id: "" },
      },
      abortSignal
    );

    if (abortSignal.isAborted || global.isShuttingDown) return;

    // ── Pass 3: Fix mobility flag on static devices ───────────────────────────
    // Old devices (e.g. 2019 cohort) that have deployment_type="static" but
    // mobility:true stored from an earlier incorrect era.  Uses the
    // {deployment_type,mobility} compound index.
    await runPass(
      tenant,
      "pass3/fix_static_mobility",
      { deployment_type: "static", mobility: { $ne: false } },
      { $set: { mobility: false } },
      abortSignal
    );

    if (abortSignal.isAborted || global.isShuttingDown) return;

    // ── Pass 4: Fix mobility flag on mobile devices ───────────────────────────
    await runPass(
      tenant,
      "pass4/fix_mobile_mobility",
      { deployment_type: "mobile", mobility: { $ne: true } },
      { $set: { mobility: true } },
      abortSignal
    );

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    logger.info(`[${POD_ID}] ${JOB_NAME}: all passes complete in ${elapsed}s.`);
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
  currentJobPromise = runCleanup("airqo").finally(() => {
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
  description: "Heals bad device mobility/deployment_type metadata 3x/day",
};

logger.info(
  `[${POD_ID}] ${JOB_NAME}: scheduled (${JOB_SCHEDULE}, tz=${TIMEZONE})${DRY_RUN ? " [DRY RUN MODE]" : ""}.`
);

module.exports = runCleanup;
