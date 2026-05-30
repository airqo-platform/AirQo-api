// src/device-registry/bin/jobs/private-cohort-alert-job.js
//
// Runs 3 times a day (06:00, 14:00, 22:00 UTC) and posts a Slack alert
// listing every private cohort that has more than 2 operational devices.
//
// A device is counted per status bucket using the same logic as
// getDeviceCountSummary in device.util.js:
//   Operational      — isOnline: true  AND rawOnlineStatus: true
//   Transmitting     — isOnline: false AND rawOnlineStatus: true
//   Data Available   — isOnline: true  AND rawOnlineStatus: false
//   Not Transmitting — isOnline: false AND rawOnlineStatus: false
//
// Only active, deployed devices are counted.
// No message is sent when there are no qualifying cohorts (no Slack noise).

const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/private-cohort-alert-job -- ops-alerts`,
);
const { logText } = require("@utils/shared");
const cron = require("node-cron");
const CohortModel = require("@models/Cohort");
const DeviceModel = require("@models/Device");
const redisClient = require("@config/redis");

const TENANT = constants.DEFAULT_TENANT || "airqo";
const JOB_NAME = "private-cohort-alert-job";
const JOB_SCHEDULE = "0 6,14,22 * * *"; // 06:00, 14:00, 22:00 UTC
const MIN_OPERATIONAL = 2; // alert threshold: more than this many operational devices

const ENV_SLUG = (constants.ENVIRONMENT || "unknown")
  .replace(/\s+/g, "_")
  .toLowerCase();
const LOCK_KEY = `${ENV_SLUG}:${JOB_NAME}:lock`;
const LOCK_TTL_SECONDS = 3600;

// ── Distributed lock ─────────────────────────────────────────────────────────

async function acquireJobLock() {
  try {
    if (!redisClient.redisUtils.isAvailable()) return true;
    const result = await redisClient.set(LOCK_KEY, "1", {
      NX: true,
      EX: LOCK_TTL_SECONDS,
    });
    return result === "OK";
  } catch (err) {
    logger.warn(
      `${JOB_NAME} -- could not acquire lock (${err.message}), proceeding without lock`,
    );
    return true;
  }
}

async function releaseJobLock() {
  try {
    if (!redisClient.redisUtils.isAvailable()) return;
    await redisClient.del(LOCK_KEY);
  } catch (err) {
    logger.warn(`${JOB_NAME} -- could not release lock: ${err.message}`);
  }
}

// ── Status counting aggregation ───────────────────────────────────────────────

async function findPrivateCohortsWithOperationalDevices() {
  // Step 1 — get IDs of all private cohorts
  const privateCohorts = await CohortModel(TENANT)
    .find({ visibility: false }, { _id: 1, name: 1 })
    .lean();

  if (!privateCohorts.length) return [];

  const cohortIds = privateCohorts.map((c) => c._id);
  const cohortNameById = Object.fromEntries(
    privateCohorts.map((c) => [c._id.toString(), c.name || c._id.toString()]),
  );

  // Step 2 — aggregate device status counts per cohort in one query
  const pipeline = [
    // Only active, deployed devices that belong to at least one private cohort
    {
      $match: {
        isActive: true,
        status: "deployed",
        cohorts: { $in: cohortIds },
      },
    },
    // Unwind so each (device, cohort) pair becomes its own document
    { $unwind: "$cohorts" },
    // Keep only rows for private cohorts
    { $match: { cohorts: { $in: cohortIds } } },
    // Classify the device status for this row
    {
      $addFields: {
        _statusBucket: {
          $switch: {
            branches: [
              {
                // Operational: online AND raw online
                case: {
                  $and: [
                    { $eq: ["$isOnline", true] },
                    { $eq: ["$rawOnlineStatus", true] },
                  ],
                },
                then: "operational",
              },
              {
                // Transmitting: NOT isOnline but raw feed is live
                case: {
                  $and: [
                    { $eq: ["$isOnline", false] },
                    { $eq: ["$rawOnlineStatus", true] },
                  ],
                },
                then: "transmitting",
              },
              {
                // Data Available: isOnline but raw feed stale
                case: {
                  $and: [
                    { $eq: ["$isOnline", true] },
                    { $eq: ["$rawOnlineStatus", false] },
                  ],
                },
                then: "data_available",
              },
            ],
            default: "not_transmitting",
          },
        },
      },
    },
    // Group by cohort ID, counting each status bucket
    {
      $group: {
        _id: "$cohorts",
        total: { $sum: 1 },
        operational: {
          $sum: { $cond: [{ $eq: ["$_statusBucket", "operational"] }, 1, 0] },
        },
        transmitting: {
          $sum: { $cond: [{ $eq: ["$_statusBucket", "transmitting"] }, 1, 0] },
        },
        data_available: {
          $sum: {
            $cond: [{ $eq: ["$_statusBucket", "data_available"] }, 1, 0],
          },
        },
        not_transmitting: {
          $sum: {
            $cond: [{ $eq: ["$_statusBucket", "not_transmitting"] }, 1, 0],
          },
        },
      },
    },
    // Only report cohorts that exceed the threshold
    { $match: { operational: { $gt: MIN_OPERATIONAL } } },
    { $sort: { operational: -1 } },
  ];

  const rows = await DeviceModel(TENANT)
    .aggregate(pipeline)
    .option({ maxTimeMS: 60000, allowDiskUse: true });

  return rows.map((row) => ({
    cohortId: row._id.toString(),
    name: cohortNameById[row._id.toString()] || row._id.toString(),
    visibility: "Private",
    total: row.total,
    operational: row.operational,
    transmitting: row.transmitting,
    data_available: row.data_available,
    not_transmitting: row.not_transmitting,
  }));
}

// ── Slack message formatter ───────────────────────────────────────────────────

function pad(str, len) {
  return String(str).padEnd(len).slice(0, len);
}

function buildSlackMessage(cohorts, runAt) {
  const dateStr = runAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";

  const COL = {
    num: 4,
    name: 38,
    total: 7,
    operational: 12,
    transmitting: 13,
    data_available: 14,
    not_transmitting: 17,
  };

  const header =
    pad("#", COL.num) +
    pad("Cohort Name", COL.name) +
    pad("Devices", COL.total) +
    pad("Operational", COL.operational) +
    pad("Transmitting", COL.transmitting) +
    pad("Data Available", COL.data_available) +
    pad("Not Transmitting", COL.not_transmitting);

  const divider = "─".repeat(
    COL.num +
      COL.name +
      COL.total +
      COL.operational +
      COL.transmitting +
      COL.data_available +
      COL.not_transmitting,
  );

  const dataRows = cohorts
    .map((c, i) =>
      pad(i + 1, COL.num) +
      pad(c.name, COL.name) +
      pad(c.total, COL.total) +
      pad(c.operational, COL.operational) +
      pad(c.transmitting, COL.transmitting) +
      pad(c.data_available, COL.data_available) +
      pad(c.not_transmitting, COL.not_transmitting),
    )
    .join("\n");

  return (
    `🔒 *Private Cohorts with Operational Devices* — ${dateStr}\n` +
    `${cohorts.length} private cohort(s) have more than ${MIN_OPERATIONAL} operational devices ` +
    `but are not visible on public maps or recent measurements.\n` +
    "```\n" +
    header +
    "\n" +
    divider +
    "\n" +
    dataRows +
    "\n" +
    "```\n" +
    `To make a cohort public: PUT /api/v2/cohorts/{id}  →  { "visibility": true }`
  );
}

// ── Main job ──────────────────────────────────────────────────────────────────

async function runPrivateCohortAlertJob() {
  const acquired = await acquireJobLock();
  if (!acquired) {
    logText(`${JOB_NAME} -- lock held by another pod, skipping this run`);
    return;
  }

  try {
    logText(`${JOB_NAME} -- starting`);
    const jobStart = Date.now();

    const cohorts = await findPrivateCohortsWithOperationalDevices();

    const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
    logText(
      `${JOB_NAME} -- found ${cohorts.length} qualifying cohort(s) in ${elapsed}s`,
    );

    if (cohorts.length === 0) {
      logText(`${JOB_NAME} -- no private cohorts exceed the threshold, no alert sent`);
      return;
    }

    const message = buildSlackMessage(cohorts, new Date());
    logger.warn(message);

    logText(`${JOB_NAME} -- alert sent for ${cohorts.length} cohort(s)`);
  } catch (error) {
    logger.error(`${JOB_NAME} -- unhandled error: ${error.message}`);
  } finally {
    await releaseJobLock();
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────

cron.schedule(JOB_SCHEDULE, () => {
  runPrivateCohortAlertJob().catch((err) => {
    logger.error(`${JOB_NAME} -- scheduler error: ${err.message}`);
  });
});

logText(`${JOB_NAME} -- scheduled (${JOB_SCHEDULE})`);

module.exports = { runPrivateCohortAlertJob };
