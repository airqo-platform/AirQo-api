/**
 * aqi-category-backfill-job.js
 *
 * Reconciles the `aqi_category`/`aqi_color`/`aqi_color_name`/`aqi_index`
 * fields already stored on Reading and Signal documents against the
 * currently-active AQI config, after an admin changes it via
 * PUT/DELETE /api/v2/devices/aqi-ranges.
 *
 * WHY:
 *   Those fields are computed once, at ingestion time, and persisted —
 *   they're a snapshot, not a live view. GET /aqi-ranges and the Nexus
 *   rankings endpoints already reflect an admin override immediately, and
 *   newly-ingested readings do too (see models/Event.js's fetchData/
 *   generateAqiAddFields), but a reading stored *before* the change keeps
 *   showing its old category until something walks the collection and
 *   corrects it. This job is that "something."
 *
 * HOW:
 *   1. Resolve the currently-active config once.
 *   2. Stream each collection (Reading, then Signal) with a cursor, in
 *      fixed-size batches.
 *   3. For each document with a numeric pm2_5.value, recompute what its
 *      aqi_category/aqi_color/aqi_color_name/aqi_index *should* be under the
 *      active config. Only queue an update if it differs from what's
 *      currently stored — an unchanged config (or a document whose category
 *      was already correct) costs a read, never a write.
 *   4. bulkWrite the differing docs, using an optimistic-concurrency filter
 *      (only apply if the stored aqi_category still matches what was read)
 *      so a concurrent, unrelated write to the same document is never
 *      clobbered.
 *
 * Bounded scope: both collections have a 14-day TTL (see models/Reading.js),
 * so this never reprocesses more than ~2 weeks of live data, regardless of
 * how long the service has been running.
 */

const cron = require("node-cron");
const os = require("os");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/aqi-category-backfill-job`
);
const jobLogger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- aqi-category-backfill-job -- ops-alerts`
);
const { logText } = require("@utils/shared");
const ReadingModel = require("@models/Reading");
const SignalModel = require("@models/Signal");
const JobLockModel = require("@models/JobLock");
const aqiUtil = require("@utils/aqi.util");

const TENANT = constants.DEFAULT_TENANT || "airqo";
const JOB_NAME = "aqi-category-backfill";
const JOB_SCHEDULE = "0 5 * * *"; // Daily 05:00 — safety net; the real trigger is event-driven (see runAqiCategoryBackfillJob's caller in aqi.controller.js)
const BATCH_SIZE = 200;
const LOCK_TTL_SECONDS = 30 * 60;
const POD_ID = process.env.HOSTNAME || os.hostname();

// Process-wide, not per-tenant — only "airqo" is an active tenant today (see
// JobLockModel for the real per-tenant cross-pod lock). If a second tenant is
// ever activated, a run for one tenant will make a concurrent trigger for
// another tenant skip rather than queue; the daily safety-net schedule (see
// JOB_SCHEDULE) still catches it on the next pass, so this degrades safely.
let isJobRunning = false;

async function acquireLock(tenant) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  try {
    const result = await JobLockModel(tenant).findOneAndUpdate(
      {
        $or: [
          { jobName: JOB_NAME, expiresAt: { $lte: now } },
          { jobName: JOB_NAME, expiresAt: { $exists: false } },
          { jobName: { $exists: false } },
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
    logger.error(`🐛🐛 ${JOB_NAME} -- lock acquisition error: ${error.message}`);
    return false;
  }
}

async function releaseLock(tenant) {
  try {
    await JobLockModel(tenant).findOneAndDelete({
      jobName: JOB_NAME,
      acquiredBy: POD_ID,
    });
  } catch (error) {
    logger.error(`🐛🐛 ${JOB_NAME} -- lock release error: ${error.message}`);
  }
}

/**
 * What a document's AQI fields should be, under the given resolved config,
 * for a given PM2.5 concentration. Mirrors models/Event.js's
 * generateAqiAddFields() logic, computed in plain JS instead of a Mongo
 * pipeline since this runs per-document over a cursor, not inside an
 * aggregation.
 */
function computeExpectedAqiFields(pm25Value, resolved) {
  if (typeof pm25Value !== "number" || isNaN(pm25Value)) {
    return null;
  }
  const category = aqiUtil.categoryFromConcentration(pm25Value, resolved);
  const { AQI_COLORS, AQI_CATEGORIES, AQI_COLOR_NAMES } = resolved;
  if (!category) {
    // Matches generateAqiAddFields()'s default branch in models/Event.js:
    // the "unknown" fallback always uses the system default constants
    // (stored bare, no leading "#" — same convention as every other stored
    // aqi_color value), never a custom config's values.
    return {
      aqi_color: constants.AQI_COLORS.unknown,
      aqi_category: constants.AQI_CATEGORIES.unknown,
      aqi_color_name: constants.AQI_COLOR_NAMES.unknown,
      aqi_index: aqiUtil.calculatePm25Aqi(pm25Value),
    };
  }
  return {
    aqi_color: AQI_COLORS[category],
    aqi_category: AQI_CATEGORIES[category],
    aqi_color_name: AQI_COLOR_NAMES[category],
    aqi_index: aqiUtil.calculatePm25Aqi(pm25Value),
  };
}

// Both Reading and Signal already carry a partial index on
// { time: -1, "pm2_5.value": 1 } (see models/Reading.js / models/Signal.js —
// "Partial index for active readings/signals only"). The query below is
// shaped to match it: `pm2_5.value > 0` satisfies both collections' partial
// filter expressions, and the `time` lower bound lets the planner use the
// index's leading field instead of falling back to a full collection scan.
// A value of 0 or less (or non-numeric/absent) is deliberately excluded —
// computeExpectedAqiFields/categoryFromConcentration treat any concentration
// <= 0 as the config-invariant "unknown" fallback (or, for exactly 0, as
// "good", whose min is always pinned to 0 regardless of any admin range
// change) — so those documents' expected fields can never actually go stale
// and are safe to skip entirely.
// The 15-day window is a deliberate 1-day buffer over the 14-day TTL, not an
// exact match — being slightly inclusive is safe (a few extra documents
// read), being too tight risks missing documents near the boundary.
const LOOKBACK_MS = 15 * 24 * 60 * 60 * 1000;

/**
 * Streams one collection, comparing each document's stored AQI fields
 * against what they should be under `resolved`, and bulk-corrects the ones
 * that differ. Returns summary counts.
 */
async function reconcileModel(Model, resolved) {
  let scanned = 0;
  let updated = 0;
  let skippedNoPm25 = 0;
  let batchOps = [];

  const cursor = Model.find({
    "pm2_5.value": { $gt: 0 },
    time: { $gte: new Date(Date.now() - LOOKBACK_MS) },
  })
    .select("_id pm2_5 aqi_color aqi_category aqi_color_name aqi_index")
    .batchSize(BATCH_SIZE)
    .lean()
    .cursor();

  const flush = async () => {
    if (batchOps.length === 0) return;
    try {
      const result = await Model.bulkWrite(batchOps, { ordered: false });
      updated += (result.modifiedCount || 0) + (result.upsertedCount || 0);
    } catch (error) {
      logger.error(`🐛🐛 ${JOB_NAME} -- bulkWrite error: ${error.message}`);
    }
    batchOps = [];
  };

  for await (const doc of cursor) {
    scanned += 1;
    const expected = computeExpectedAqiFields(doc.pm2_5?.value, resolved);
    if (!expected) {
      skippedNoPm25 += 1;
      continue;
    }

    const alreadyCorrect =
      doc.aqi_color === expected.aqi_color &&
      doc.aqi_category === expected.aqi_category &&
      doc.aqi_color_name === expected.aqi_color_name &&
      doc.aqi_index === expected.aqi_index;
    if (alreadyCorrect) continue;

    batchOps.push({
      updateOne: {
        // Optimistic concurrency: only apply if the stored aqi_category
        // hasn't changed since we read it, so a concurrent unrelated write
        // to this same document is never clobbered.
        filter: { _id: doc._id, aqi_category: doc.aqi_category },
        update: { $set: expected },
      },
    });

    if (batchOps.length >= BATCH_SIZE) {
      await flush();
    }
  }
  await flush();

  return { scanned, updated, skippedNoPm25 };
}

async function runAqiCategoryBackfillJob(tenant = TENANT) {
  if (isJobRunning) {
    logText(`${JOB_NAME} -- already running, skipping this execution`);
    return;
  }
  isJobRunning = true;

  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logText(`${JOB_NAME} -- skipping run: another instance holds the lock`);
    isJobRunning = false;
    return;
  }

  const runStart = Date.now();
  try {
    const resolved = await aqiUtil.resolveActiveAqiRanges(tenant);
    logText(
      `${JOB_NAME} -- reconciling tenant=${tenant} against source=${resolved.source} config`
    );

    const readingsSummary = await reconcileModel(ReadingModel(tenant), resolved);
    const signalsSummary = await reconcileModel(SignalModel(tenant), resolved);

    const elapsed = ((Date.now() - runStart) / 1000).toFixed(1);
    jobLogger.info(
      `${JOB_NAME} -- completed in ${elapsed}s -- ` +
        `readings: scanned=${readingsSummary.scanned} updated=${readingsSummary.updated} ` +
        `-- signals: scanned=${signalsSummary.scanned} updated=${signalsSummary.updated}`
    );
  } catch (error) {
    logger.error(`🐛🐛 ${JOB_NAME} -- run failed: ${error.message}`);
  } finally {
    await releaseLock(tenant);
    isJobRunning = false;
  }
}

cron.schedule(JOB_SCHEDULE, () => {
  runAqiCategoryBackfillJob().catch((error) => {
    logger.error(`🐛🐛 ${JOB_NAME} -- unhandled error: ${error.message}`);
  });
});

logText(`${JOB_NAME} -- scheduled (${JOB_SCHEDULE})`);
console.log(
  `✅ ${JOB_NAME} started - daily safety net; also triggered right after an AQI config change`
);

module.exports = { runAqiCategoryBackfillJob };
