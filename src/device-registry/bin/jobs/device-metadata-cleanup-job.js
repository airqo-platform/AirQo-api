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
 *    Action: set deployment_type="mobile", mobility=true.
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
 * • Mongoose middleware is bypassed (collection.updateMany) so the pre-save
 *   hook's mobility↔deployment_type sync does not re-run and produce
 *   redundant writes.
 * • Distributed locking (JobLock) prevents duplicate runs across pods.
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
const LOCK_TTL_SECONDS = 60 * 60; // 1 hour — generous for large fleets
const BATCH_SIZE = 500; // IDs fetched per DB round-trip
const INTER_BATCH_DELAY_MS = 50; // breathing room between batches
const DRY_RUN = process.env.DEVICE_METADATA_CLEANUP_DRY_RUN === "true";

// Mirror the constant from Device.js / constants
const UN_DEPLOYED_STATUSES = constants.VALID_DEVICE_STATUSES
  ? constants.VALID_DEVICE_STATUSES.filter((s) => s !== "deployed")
  : [
      "recalled",
      "ready",
      "undeployed",
      "decommissioned",
      "assembly",
      "testing",
      "not deployed",
    ];

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
 * @param {string}  tenant    - Tenant key (e.g. "airqo")
 * @param {string}  passName  - Human-readable label for logs
 * @param {object}  filter    - MongoDB match filter for dirty documents
 * @param {object}  updateOp  - Raw MongoDB update operator ($set / $unset)
 * @returns {Promise<number>} Count of modified documents
 */
const runPass = async (tenant, passName, filter, updateOp) => {
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
      const result = await collection.updateMany(
        { _id: { $in: ids } },
        updateOp
      );
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
      { $set: { deployment_type: "static", mobility: false } }
    );

    if (global.isShuttingDown) return;

    // ── Pass 2: Backfill deployment_type="mobile" from grid_id ───────────────
    // Grid-assigned deployed devices without an explicit deployment_type.
    await runPass(
      tenant,
      "pass2/backfill_mobile",
      {
        status: "deployed",
        deployment_type: { $exists: false },
        grid_id: { $exists: true, $ne: null },
      },
      { $set: { deployment_type: "mobile", mobility: true } }
    );

    if (global.isShuttingDown) return;

    // ── Pass 3: Fix mobility flag on static devices ───────────────────────────
    // Old devices (e.g. 2019 cohort) that have deployment_type="static" but
    // mobility:true stored from an earlier incorrect era.  Uses the
    // {deployment_type,mobility} compound index.
    await runPass(
      tenant,
      "pass3/fix_static_mobility",
      { deployment_type: "static", mobility: { $ne: false } },
      { $set: { mobility: false } }
    );

    if (global.isShuttingDown) return;

    // ── Pass 4: Fix mobility flag on mobile devices ───────────────────────────
    await runPass(
      tenant,
      "pass4/fix_mobile_mobility",
      { deployment_type: "mobile", mobility: { $ne: true } },
      { $set: { mobility: true } }
    );

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    logger.info(`[${POD_ID}] ${JOB_NAME}: all passes complete in ${elapsed}s.`);
  } catch (error) {
    logger.error(`[${POD_ID}] ${JOB_NAME} error: ${error.message}`);
  } finally {
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
