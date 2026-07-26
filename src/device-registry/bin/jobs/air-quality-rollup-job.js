/**
 * air-quality-rollup-job.js
 *
 * Runs daily and folds newly-ingested readings into permanent country/city
 * PM2.5 running totals (AirQualitySummary), keyed by {tenant, level, entity, year}.
 *
 * WHY:
 *   Reading documents are purged from MongoDB ~14 days after ingestion (see the
 *   TTL indexes on Reading.time / Reading.createdAt). GET .../readings/rankings/history
 *   originally aggregated the raw readings collection live, which meant it could
 *   only ever see the last ~2 weeks regardless of the start_year/end_year requested.
 *   This job captures each day's data into a durable running total *before* the
 *   source documents are purged, so real multi-year history accumulates over time
 *   from whenever this job started running. It cannot recover history from before
 *   that point — that data is already gone.
 *
 * HOW:
 *   1. Read the watermark (JobState) for the last successfully processed time.
 *      First run defaults to 24h ago; the window is floored at 14 days back as a
 *      defensive guard (a watermark older than that means real, permanent gaps —
 *      logged as a warning, not silently patched over).
 *   2. Aggregate the readings collection over [watermark, runStart) twice — once
 *      grouped by siteDetails.country, once by siteDetails.city — both restricted
 *      to the same African country allowlist the rankings endpoints already use.
 *   3. Upsert each {entity, year} group into AirQualitySummary via $inc (running
 *      sum/count) and $addToSet (contributing site ids) — never overwritten,
 *      always accumulated.
 *   4. Only advance the watermark after the bulkWrite succeeds, so a crashed run
 *      safely reprocesses the same window next time rather than losing data.
 *
 * Trade-off, accepted deliberately: the bulkWrite (up to ~150 entities) isn't
 * wrapped in a transaction. A crash between the bulkWrite succeeding and the
 * watermark advancing is impossible (watermark only advances after success);
 * a crash *during* the bulkWrite could in principle double-count a subset of one
 * day's data on the retry. At daily cadence over a year's worth of increments,
 * that's a negligible, self-diluting skew — not worth a transactional pipeline
 * at this scale.
 */

const cron = require("node-cron");
const os = require("os");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/air-quality-rollup-job`
);
const { logText } = require("@utils/shared");
const ReadingModel = require("@models/Reading");
const JobStateModel = require("@models/JobState");
const JobLockModel = require("@models/JobLock");
const AirQualitySummaryModel = require("@models/AirQualitySummary");

const TENANT = constants.DEFAULT_TENANT || "airqo";
const JOB_NAME = "air-quality-rollup-job";
const JOB_SCHEDULE = "0 4 * * *"; // Daily at 04:00 — a >10x safety margin under the 14-day TTL
const RAW_DATA_RETENTION_MS = 14 * 24 * 60 * 60 * 1000; // matches Reading's TTL indexes
const DEFAULT_LOOKBACK_MS = 24 * 60 * 60 * 1000; // first-run default window

const POD_ID = process.env.HOSTNAME || os.hostname();
const LOCK_TTL_SECONDS = 55 * 60; // job runs once/day; this only guards against overlap on retry

// In-process overlap guard — same convention as store-readings-job.js /
// precompute-activities-job.js. Belt-and-suspenders alongside the cross-pod
// JobLock below.
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
 * Aggregate the delta window once per level, grouped by the corresponding
 * siteDetails field, restricted to the African country allowlist.
 */
async function aggregateDeltaWindow(tenant, level, windowStart, windowEnd) {
  const groupField = `$siteDetails.${level}`;
  const africanCountries = Object.keys(constants.countryCodes);

  const pipeline = [
    {
      $match: {
        time: { $gte: windowStart, $lt: windowEnd },
        "siteDetails.country": { $in: africanCountries },
        "pm2_5.value": { $ne: null, $type: "number" },
      },
    },
    { $addFields: { year: { $year: "$time" } } },
    {
      $group: {
        _id: { entity: groupField, year: "$year" },
        sum_pm2_5: { $sum: "$pm2_5.value" },
        reading_count: { $sum: 1 },
        siteIds: { $addToSet: "$site_id" },
      },
    },
    { $match: { "_id.entity": { $ne: null } } },
  ];

  return ReadingModel(tenant)
    .aggregate(pipeline)
    .option({
      allowDiskUse: true,
      maxTimeMS: constants.READINGS_AGGREGATE_TIMEOUT_MS,
    });
}

/**
 * Upsert one level's delta-window groups into AirQualitySummary as running
 * totals — $inc, never overwritten.
 */
async function upsertDelta(tenant, level, groups, runAt) {
  if (!groups.length) return 0;

  const ops = groups.map((group) => ({
    updateOne: {
      filter: {
        tenant,
        level,
        entity: group._id.entity,
        year: group._id.year,
      },
      update: {
        $inc: {
          sum_pm2_5: group.sum_pm2_5,
          reading_count: group.reading_count,
        },
        $addToSet: { contributing_sites: { $each: group.siteIds } },
        $set: { last_updated_at: runAt },
        $setOnInsert: {
          tenant,
          level,
          entity: group._id.entity,
          year: group._id.year,
        },
      },
      upsert: true,
    },
  }));

  await AirQualitySummaryModel(tenant).bulkWrite(ops, { ordered: false });
  return groups.length;
}

async function runAirQualityRollupJob() {
  if (isJobRunning) {
    logText(`${JOB_NAME} -- already running, skipping this execution`);
    return;
  }
  isJobRunning = true;

  const lockAcquired = await acquireLock(TENANT);
  if (!lockAcquired) {
    logText(`${JOB_NAME} -- skipping run: another instance holds the lock`);
    isJobRunning = false;
    return;
  }

  const runStart = new Date();

  try {
    let watermark = await JobStateModel(TENANT).get(JOB_NAME);
    if (!watermark) {
      watermark = new Date(runStart.getTime() - DEFAULT_LOOKBACK_MS);
      logText(
        `${JOB_NAME} -- no prior watermark, defaulting to ${watermark.toISOString()}`
      );
    }

    const retentionFloor = new Date(runStart.getTime() - RAW_DATA_RETENTION_MS);
    if (watermark < retentionFloor) {
      logger.warn(
        `${JOB_NAME} -- watermark (${watermark.toISOString()}) is older than the ` +
          `raw-data retention window; readings between then and ${retentionFloor.toISOString()} ` +
          `are permanently unrecoverable. Flooring the window rather than attempting to reprocess them.`
      );
      watermark = retentionFloor;
    }

    if (watermark >= runStart) {
      logText(`${JOB_NAME} -- watermark is not behind runStart, nothing to do`);
      return;
    }

    logText(
      `${JOB_NAME} -- processing window [${watermark.toISOString()}, ${runStart.toISOString()})`
    );

    let totalGroups = 0;
    for (const level of ["country", "city"]) {
      const groups = await aggregateDeltaWindow(TENANT, level, watermark, runStart);
      const upserted = await upsertDelta(TENANT, level, groups, runStart);
      totalGroups += upserted;
      logText(`${JOB_NAME} -- ${level}: ${upserted} entity/year group(s) updated`);
    }

    await JobStateModel(TENANT).set(JOB_NAME, runStart);

    const elapsed = ((Date.now() - runStart.getTime()) / 1000).toFixed(1);
    logText(
      `${JOB_NAME} -- completed in ${elapsed}s: ${totalGroups} total entity/year group(s) updated`
    );
  } catch (error) {
    logger.error(`🐛🐛 ${JOB_NAME} -- run failed: ${error.message}`);
  } finally {
    await releaseLock(TENANT);
    isJobRunning = false;
  }
}

cron.schedule(JOB_SCHEDULE, () => {
  runAirQualityRollupJob().catch((error) => {
    logger.error(`🐛🐛 ${JOB_NAME} -- unhandled error: ${error.message}`);
  });
});

logText(`${JOB_NAME} -- scheduled (${JOB_SCHEDULE})`);
console.log(`✅ ${JOB_NAME} started - rolling up country/city PM2.5 history daily`);

module.exports = { runAirQualityRollupJob };
