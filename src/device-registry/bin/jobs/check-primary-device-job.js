// src/device-registry/bin/jobs/check-primary-device-job.js
//
// Runs daily at 02:00 UTC. Finds all sites where no deployed device carries
// isPrimaryInLocation: true and takes one of two actions:
//
//   1-device site  → auto-fix: set isPrimaryInLocation=true on that device so
//                    update-raw-online-status-job can propagate rawOnlineStatus
//                    to the site without any manual intervention.
//
//   Multi-device site → Slack alert listing the site and its devices so the
//                       team can decide which device should be primary.
//
// Also detects sites where more than one device is primary and alerts, since
// the system has no write-time guard against that condition.

const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-primary-device-job -- ops-alerts`,
);
const { logText } = require("@utils/shared");
const cron = require("node-cron");
const DeviceModel = require("@models/Device");
const crypto = require("crypto");
const redisClient = require("@config/redis");

const TENANT = constants.DEFAULT_TENANT || "airqo";
const JOB_NAME = "check-primary-device-job";
const JOB_SCHEDULE = "0 2 * * *"; // daily at 02:00 UTC

const ENV_SLUG = (constants.ENVIRONMENT || "unknown")
  .replace(/\s+/g, "_")
  .toLowerCase();
const LOCK_KEY = `${ENV_SLUG}:${JOB_NAME}:lock`;
const LOCK_TTL_SECONDS = 3600;

// ── Distributed lock ──────────────────────────────────────────────────────────

let _lockToken = null;

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

async function acquireJobLock() {
  try {
    if (!redisClient.redisUtils.isAvailable()) return true;
    _lockToken = crypto.randomUUID();
    const result = await redisClient.set(LOCK_KEY, _lockToken, {
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
    if (_lockToken) {
      await redisClient.eval(RELEASE_SCRIPT, {
        keys: [LOCK_KEY],
        arguments: [_lockToken],
      });
      _lockToken = null;
    }
  } catch (err) {
    logger.warn(`${JOB_NAME} -- could not release lock: ${err.message}`);
  }
}

// ── Aggregation ───────────────────────────────────────────────────────────────

async function findSitesWithPrimaryIssues() {
  // Group all active, deployed devices with a site_id by site, collecting the
  // list of device names and how many are primary.
  const pipeline = [
    {
      $match: {
        isActive: true,
        status: "deployed",
        site_id: { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: "$site_id",
        totalDevices: { $sum: 1 },
        primaryCount: {
          $sum: { $cond: [{ $eq: ["$isPrimaryInLocation", true] }, 1, 0] },
        },
        devices: {
          $push: { name: "$name", isPrimary: "$isPrimaryInLocation", id: "$_id" },
        },
      },
    },
    {
      $match: {
        $or: [
          { primaryCount: 0 },      // no primary — needs fix or alert
          { primaryCount: { $gt: 1 } }, // multiple primaries — alert
        ],
      },
    },
  ];

  return DeviceModel(TENANT)
    .aggregate(pipeline)
    .option({ maxTimeMS: 120000, allowDiskUse: true });
}

// ── Auto-fix: single-device sites ────────────────────────────────────────────

async function autoFixSingleDeviceSites(noPrimarySites) {
  const singleDeviceSites = noPrimarySites.filter((s) => s.totalDevices === 1);
  if (singleDeviceSites.length === 0) return 0;

  const bulkOps = singleDeviceSites.map((site) => ({
    updateOne: {
      filter: { _id: site.devices[0].id },
      update: { $set: { isPrimaryInLocation: true } },
    },
  }));

  const result = await DeviceModel(TENANT).bulkWrite(bulkOps, { ordered: false });
  return result.modifiedCount;
}

// ── Slack message builders ────────────────────────────────────────────────────

function buildNoPrimaryMultiDeviceMessage(sites, runAt) {
  const dateStr = runAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const rows = sites
    .map((s, i) => {
      const deviceList = s.devices
        .map((d) => d.name)
        .join(", ");
      return `  ${i + 1}. Site ${s._id} — ${s.totalDevices} devices: ${deviceList}`;
    })
    .join("\n");

  return (
    `⚠️ *Sites with no primary device (multiple devices)* — ${dateStr}\n` +
    `${sites.length} site(s) have multiple deployed devices but none is marked isPrimaryInLocation=true.\n` +
    `rawOnlineStatus will not propagate to these sites until a primary is assigned.\n` +
    "```\n" +
    rows +
    "\n```\n" +
    `Fix: PUT /api/v2/devices/{name}  →  { "isPrimaryInLocation": true }`
  );
}

function buildMultiplePrimaryMessage(sites, runAt) {
  const dateStr = runAt.toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const rows = sites
    .map((s, i) => {
      const primaries = s.devices
        .filter((d) => d.isPrimary)
        .map((d) => d.name)
        .join(", ");
      return `  ${i + 1}. Site ${s._id} — ${s.primaryCount} primaries: ${primaries}`;
    })
    .join("\n");

  return (
    `⚠️ *Sites with multiple primary devices* — ${dateStr}\n` +
    `${sites.length} site(s) have more than one device with isPrimaryInLocation=true.\n` +
    `Only one primary is expected; this may cause duplicate site status updates.\n` +
    "```\n" +
    rows +
    "\n```\n" +
    `Fix: PUT /api/v2/devices/{name}  →  { "isPrimaryInLocation": false } on all but one.`
  );
}

// ── Main job ──────────────────────────────────────────────────────────────────

async function runCheckPrimaryDeviceJob() {
  const acquired = await acquireJobLock();
  if (!acquired) {
    logText(`${JOB_NAME} -- lock held by another pod, skipping`);
    return;
  }

  try {
    logText(`${JOB_NAME} -- starting`);
    const jobStart = Date.now();

    const problemSites = await findSitesWithPrimaryIssues();

    const noPrimarySites = problemSites.filter((s) => s.primaryCount === 0);
    const multiPrimarySites = problemSites.filter((s) => s.primaryCount > 1);

    const singleDeviceNoPrimary = noPrimarySites.filter((s) => s.totalDevices === 1);
    const multiDeviceNoPrimary = noPrimarySites.filter((s) => s.totalDevices > 1);

    // Auto-fix single-device sites
    if (singleDeviceNoPrimary.length > 0) {
      const fixed = await autoFixSingleDeviceSites(singleDeviceNoPrimary);
      const deviceNames = singleDeviceNoPrimary
        .map((s) => s.devices[0].name)
        .join(", ");
      logText(
        `${JOB_NAME} -- auto-fixed ${fixed} single-device site(s): ${deviceNames}`,
      );
      logger.info(
        `${JOB_NAME} -- auto-fixed isPrimaryInLocation=true on ${fixed} device(s): ${deviceNames}`,
      );
    }

    const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
    logText(`${JOB_NAME} -- scan complete in ${elapsed}s`);

    // Alert for multi-device sites with no primary
    if (multiDeviceNoPrimary.length > 0) {
      logger.warn(buildNoPrimaryMultiDeviceMessage(multiDeviceNoPrimary, new Date()));
    }

    // Alert for sites with multiple primaries
    if (multiPrimarySites.length > 0) {
      logger.warn(buildMultiplePrimaryMessage(multiPrimarySites, new Date()));
    }

    if (noPrimarySites.length === 0 && multiPrimarySites.length === 0) {
      logText(`${JOB_NAME} -- all sites have exactly one primary device, no issues found`);
    }
  } catch (error) {
    logger.error(`${JOB_NAME} -- unhandled error: ${error.message}`);
  } finally {
    await releaseJobLock();
  }
}

// ── Schedule ──────────────────────────────────────────────────────────────────

cron.schedule(
  JOB_SCHEDULE,
  () => {
    runCheckPrimaryDeviceJob().catch((err) => {
      logger.error(`${JOB_NAME} -- scheduler error: ${err.message}`);
    });
  },
  { timezone: "UTC" },
);

logText(`${JOB_NAME} -- scheduled (${JOB_SCHEDULE})`);

module.exports = { runCheckPrimaryDeviceJob };
