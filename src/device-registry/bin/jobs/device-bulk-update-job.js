"use strict";
/**
 * device-bulk-update-job.js
 *
 * Runs on app start. Reads all pending DeviceBulkUpdateJob documents from the
 * DB and processes them sequentially. Each job:
 *   - Acquires a distributed lock (JobLock) so only one pod runs it.
 *   - Skips devices already in processedIds — making every run idempotent.
 *   - Persists progress after each batch so a crash is safely resumable.
 *   - Respects pause / cancel signals written by the management API.
 */
const DeviceBulkUpdateJobModel = require("@models/DeviceBulkUpdateJob");
const DeviceModel = require("@models/Device");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");
const os = require("os");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device-bulk-update-job`
);

const POD_ID = process.env.HOSTNAME || os.hostname();
const LOCK_TTL_SECONDS = 30 * 60; // 30 minutes — generous for large fleets
const INTER_BATCH_DELAY_MS = 200; // breathing room between batches

// Tracks every tenant for which this pod has acquired at least one lock so
// the shutdown handler can release locks across all of them, not just "airqo".
const acquiredTenants = new Set();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Lock helpers ──────────────────────────────────────────────────────────────

const acquireJobLock = async (tenant, lockName) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  try {
    // $set overwrites acquiredBy/acquiredAt/expiresAt on both insert AND on
    // an expired-lock match, so this pod atomically reclaims expired locks.
    // $setOnInsert is reserved for jobName (immutable after creation).
    const result = await JobLockModel(tenant).findOneAndUpdate(
      {
        jobName: lockName,
        $or: [{ expiresAt: { $lte: now } }, { expiresAt: { $exists: false } }],
      },
      {
        $set: { acquiredBy: POD_ID, acquiredAt: now, expiresAt },
        $setOnInsert: { jobName: lockName },
      },
      { upsert: true, new: true, rawResult: false }
    );
    const acquired = result && result.acquiredBy === POD_ID;
    if (acquired) acquiredTenants.add(tenant);
    return acquired;
  } catch (error) {
    if (error.code === 11000) return false; // Another pod beat us to it
    logger.error(`🐛🐛 Lock acquisition error [${lockName}]: ${error.message}`);
    return false;
  }
};

const releaseJobLock = async (tenant, lockName) => {
  try {
    await JobLockModel(tenant).findOneAndDelete({
      jobName: lockName,
      acquiredBy: POD_ID,
    });
  } catch (error) {
    logger.error(`🐛🐛 Lock release error [${lockName}]: ${error.message}`);
  }
};

// ── Core batch processor ──────────────────────────────────────────────────────

const runSingleJob = async (job) => {
  const { tenant, _id: jobId, name, filter, updateData, batchSize, dryRun } =
    job;
  const lockName = `device-bulk-update-${jobId}`;

  const lockAcquired = await acquireJobLock(tenant, lockName);
  if (!lockAcquired) {
    logger.info(
      `[${POD_ID}] Job "${name}" (${jobId}) locked by another pod — skipping.`
    );
    return;
  }

  try {
    await DeviceBulkUpdateJobModel(tenant).findByIdAndUpdate(jobId, {
      $set: { status: "running", startedAt: new Date(), lastRunAt: new Date() },
      $inc: { runCount: 1 },
    });

    logger.info(
      `[${POD_ID}] Starting bulk update job "${name}" (${jobId}). dryRun=${dryRun}`
    );

    // On the very first run, record the grand total so the API can show
    // accurate progress. Subsequent runs re-use the stored value.
    if (job.totalDevices === null) {
      const grandTotal = await DeviceModel(tenant).countDocuments(filter);
      await DeviceBulkUpdateJobModel(tenant).findByIdAndUpdate(jobId, {
        $set: { totalDevices: grandTotal },
      });
      logger.info(
        `[${POD_ID}] Job "${name}": ${grandTotal} total devices match the filter.`
      );
    }

    let batchSuccesses = 0;
    let batchFailures = 0;

    while (true) {
      // Re-fetch fresh state each iteration to pick up pause/cancel signals
      // written by the management API, and to get the current cursor position.
      const currentJob = await DeviceBulkUpdateJobModel(tenant)
        .findById(jobId)
        .select("lastSeenId status")
        .lean();

      if (!currentJob) {
        logger.warn(`[${POD_ID}] Job "${name}" was deleted mid-run — halting.`);
        break;
      }

      if (["paused", "cancelled"].includes(currentJob.status)) {
        logger.info(
          `[${POD_ID}] Job "${name}" is ${currentJob.status} — halting gracefully.`
        );
        break;
      }

      // Cursor-based batch: fetch devices with _id > lastSeenId in stable
      // ascending order. O(1) storage — no unbounded $nin array in the query.
      const cursorFilter = currentJob.lastSeenId
        ? { ...filter, _id: { $gt: currentJob.lastSeenId } }
        : filter;

      const devices = await DeviceModel(tenant)
        .find(cursorFilter)
        .select("_id")
        .sort({ _id: 1 })
        .limit(batchSize)
        .lean();

      if (devices.length === 0) break; // All done

      const deviceIds = devices.map((d) => d._id);
      const newLastSeenId = deviceIds[deviceIds.length - 1];

      if (dryRun) {
        logger.info(
          `[${POD_ID}] [DRY RUN] Job "${name}": would apply ${JSON.stringify(
            updateData
          )} to ${deviceIds.length} device(s).`
        );
        await DeviceBulkUpdateJobModel(tenant).findByIdAndUpdate(jobId, {
          $set: { lastSeenId: newLastSeenId },
          $inc: { processedCount: deviceIds.length },
        });
        batchSuccesses += deviceIds.length;
        await sleep(INTER_BATCH_DELAY_MS);
        continue;
      }

      try {
        await DeviceModel(tenant).updateMany(
          { _id: { $in: deviceIds } },
          { $set: updateData },
          { runValidators: true }
        );

        await DeviceBulkUpdateJobModel(tenant).findByIdAndUpdate(jobId, {
          $set: { lastSeenId: newLastSeenId },
          $inc: { processedCount: deviceIds.length },
        });

        batchSuccesses += deviceIds.length;
        logger.info(
          `[${POD_ID}] Job "${name}": batch of ${deviceIds.length} updated. ` +
            `Running total: ${batchSuccesses}.`
        );
      } catch (batchError) {
        // Record failures but advance the cursor so we don't retry the same
        // batch indefinitely — failed device IDs are preserved in failedIds.
        await DeviceBulkUpdateJobModel(tenant).findByIdAndUpdate(jobId, {
          $set: { lastSeenId: newLastSeenId, lastError: batchError.message },
          $addToSet: { failedIds: { $each: deviceIds } },
          $inc: {
            failedCount: deviceIds.length,
            processedCount: deviceIds.length,
          },
        });
        batchFailures += deviceIds.length;
        logger.error(
          `[${POD_ID}] Job "${name}": batch failed — ${batchError.message}`
        );
      }

      await sleep(INTER_BATCH_DELAY_MS);
    }

    // Determine final status
    const finalJob = await DeviceBulkUpdateJobModel(tenant)
      .findById(jobId)
      .select("processedCount totalDevices status")
      .lean();

    if (finalJob && !["paused", "cancelled"].includes(finalJob.status)) {
      const allDone =
        finalJob.totalDevices !== null &&
        finalJob.processedCount >= finalJob.totalDevices;

      await DeviceBulkUpdateJobModel(tenant).findByIdAndUpdate(jobId, {
        $set: {
          status:
            batchFailures > 0 && batchSuccesses === 0
              ? "failed"
              : allDone && batchFailures > 0
              ? "completed_with_errors"
              : allDone
              ? "completed"
              : "pending", // More devices appeared or filter mismatch — re-queue
          ...(allDone && { completedAt: new Date() }),
        },
      });
    }

    logger.info(
      `[${POD_ID}] Job "${name}" finished. ` +
        `Succeeded: ${batchSuccesses}, Failed: ${batchFailures}.`
    );
  } catch (error) {
    logger.error(
      `[${POD_ID}] 🐛🐛 Fatal error in job "${name}" (${jobId}): ${error.message}`
    );
    await DeviceBulkUpdateJobModel(tenant).findByIdAndUpdate(jobId, {
      $set: { status: "failed", lastError: error.message },
    });
  } finally {
    await releaseJobLock(tenant, lockName);
  }
};

// ── Entry point (called on app start) ────────────────────────────────────────

const runPendingBulkUpdateJobs = async (tenant = "airqo") => {
  try {
    // Jobs left in "running" from a previously crashed pod are safe to retry.
    const stuckCount = await DeviceBulkUpdateJobModel(tenant).countDocuments({
      status: "running",
    });
    if (stuckCount > 0) {
      await DeviceBulkUpdateJobModel(tenant).updateMany(
        { status: "running" },
        { $set: { status: "pending" } }
      );
      logger.warn(
        `[${POD_ID}] Reset ${stuckCount} stuck "running" job(s) back to "pending".`
      );
    }

    const pendingJobs = await DeviceBulkUpdateJobModel(tenant)
      .find({ status: "pending" })
      .lean();

    if (pendingJobs.length === 0) {
      logger.info(`[${POD_ID}] No pending device bulk update jobs.`);
      return;
    }

    logger.info(
      `[${POD_ID}] Found ${pendingJobs.length} pending bulk update job(s) — processing sequentially.`
    );

    for (const job of pendingJobs) {
      await runSingleJob(job);
    }
  } catch (error) {
    logger.error(
      `[${POD_ID}] 🐛🐛 runPendingBulkUpdateJobs error: ${error.message}`
    );
  }
};

// Graceful shutdown — release locks across every tenant this pod has touched.
const shutdown = async (signal) => {
  logger.warn(`[${POD_ID}] ${signal} received — device-bulk-update-job shutting down.`);
  for (const tenant of acquiredTenants) {
    try {
      await JobLockModel(tenant).deleteMany({ acquiredBy: POD_ID });
    } catch (_) {
      // Best-effort — do not block shutdown on a single tenant failure
    }
  }
  acquiredTenants.clear();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = runPendingBulkUpdateJobs;
