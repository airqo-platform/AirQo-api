const cron = require("node-cron");
const moment = require("moment-timezone");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/fix-corrupted-raw-data-job`,
);
const os = require("os");

const JOB_NAME = "fix-corrupted-raw-data-job";
const JOB_SCHEDULE = "50 * * * *"; // At minute 50 of every hour — after the
// raw (:35) and calibrated (:45) status jobs, so it reacts to the freshest
// dateValidStatus verdict written this hour.
const TIMEZONE = moment.tz.guess();
const LOCK_TTL_SECONDS = 15 * 60;
const POD_ID = process.env.HOSTNAME || os.hostname();

/**
 * Ongoing cleanup for devices/sites whose raw feed got stuck on a
 * future-dated reading (e.g. a device with a dead RTC battery). The (now
 * fixed) raw-status jobs already stop a bad timestamp from being written
 * going forward and correctly compute rawOnlineStatus/isOnline/dateValidStatus
 * — but they never overwrite an *already*-corrupted lastRawData /
 * latest_pm2_5.raw once the channel stops sending anything new to validate.
 * This job clears those two fields once dateValidStatus confirms the last
 * check was rejected as a future timestamp, so a stale reading doesn't
 * display as "current" forever.
 *
 * Preselects via an indexed { dateValidStatus, lastRawData } query so a
 * clean fleet costs one cheap count per collection and the job is a no-op —
 * it never scans or touches devices/sites that don't need correction.
 */
const buildStuckFilter = () => ({
  dateValidStatus: "future_timestamp",
  lastRawData: { $gt: new Date() },
});

const acquireLock = async (tenant) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  try {
    const result = await JobLockModel(tenant).findOneAndUpdate(
      {
        jobName: JOB_NAME,
        $or: [
          { jobName: { $exists: false } },
          { expiresAt: { $lte: now } },
          { acquiredBy: POD_ID },
        ],
      },
      {
        $set: { acquiredBy: POD_ID, acquiredAt: now, expiresAt },
        $setOnInsert: { jobName: JOB_NAME },
      },
      { upsert: true, new: true, rawResult: false },
    );
    return result && result.acquiredBy === POD_ID;
  } catch (error) {
    if (error.code === 11000) return false;
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

// Clears lastRawData + latest_pm2_5.raw on every stuck document in `docs`, and
// resets dateValidStatus to "unknown" alongside them — once the corrupted
// timestamp is gone there's no longer any fresh evidence backing a
// "future_timestamp" verdict, so leaving it behind would orphan a diagnostic
// claim with nothing to point to.
// Conditional on the originally observed lastRawData so a concurrent,
// legitimate write (e.g. the device finally sending a sane reading) between
// the find() above and this update isn't clobbered by our stale snapshot.
// A single bulkWrite keeps this to one round-trip regardless of batch size;
// standard bulkWrite results only report an aggregate modifiedCount (no
// per-operation detail), so concurrent-change skips are logged as a count
// rather than per-document.
const clearStuckRawData = async (Model, docs, label) => {
  if (!docs.length) return 0;

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id, lastRawData: doc.lastRawData },
      update: {
        $set: {
          lastRawData: null,
          dateValidStatus: "unknown",
          "latest_pm2_5.raw.value": null,
          "latest_pm2_5.raw.time": null,
        },
      },
    },
  }));

  const result = await Model.collection.bulkWrite(ops, { ordered: false });
  const cleared = result.modifiedCount || 0;
  const skipped = docs.length - cleared;
  if (skipped > 0) {
    logger.info(
      `[${POD_ID}] ${JOB_NAME}: ${skipped} ${label}(s) changed concurrently, skipped.`,
    );
  }
  return cleared;
};

const fixCorruptedRawData = async (tenant = "airqo") => {
  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logger.info(
      `[${POD_ID}] Could not acquire lock for ${JOB_NAME} — another pod is running it.`,
    );
    return;
  }

  try {
    const Device = DeviceModel(tenant);
    const Site = SiteModel(tenant);
    const filter = buildStuckFilter();

    const [deviceCount, siteCount] = await Promise.all([
      Device.countDocuments(filter),
      Site.countDocuments(filter),
    ]);

    if (deviceCount === 0 && siteCount === 0) {
      logger.info(
        `[${POD_ID}] ${JOB_NAME}: no devices or sites stuck on a future-dated raw reading — skipping.`,
      );
      return;
    }

    logger.info(
      `[${POD_ID}] ${JOB_NAME}: found ${deviceCount} device(s), ${siteCount} site(s) stuck on a future-dated raw reading. Clearing...`,
    );

    const [devices, sites] = await Promise.all([
      deviceCount > 0
        ? Device.find(filter).select("_id lastRawData").lean()
        : [],
      siteCount > 0 ? Site.find(filter).select("_id lastRawData").lean() : [],
    ]);

    const [devicesCleared, sitesCleared] = await Promise.all([
      clearStuckRawData(Device, devices, "device"),
      clearStuckRawData(Site, sites, "site"),
    ]);

    logger.info(
      `[${POD_ID}] ${JOB_NAME}: done. Devices cleared: ${devicesCleared}/${deviceCount}, sites cleared: ${sitesCleared}/${siteCount}.`,
    );
  } catch (error) {
    logger.error(`[${POD_ID}] ${JOB_NAME} error: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

const startJob = () => {
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    return;
  }

  try {
    let isJobRunning = false;
    let currentJobPromise = null;

    const cronJobInstance = cron.schedule(
      JOB_SCHEDULE,
      async () => {
        if (isJobRunning) {
          logger.warn(
            `${JOB_NAME} is already running, skipping this execution.`,
          );
          return;
        }

        isJobRunning = true;
        currentJobPromise = fixCorruptedRawData("airqo");

        try {
          await currentJobPromise;
        } catch (err) {
          logger.error(
            `🐛🐛 Error executing ${JOB_NAME}: ${err.stack || err.message}`,
          );
        } finally {
          isJobRunning = false;
          currentJobPromise = null;
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE,
      },
    );

    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    global.cronJobs[JOB_NAME] = {
      job: cronJobInstance,
      stop: async () => {
        cronJobInstance.stop();
        try {
          if (currentJobPromise) {
            await currentJobPromise;
          }
        } catch (error) {
          logger.error(
            `🐛🐛 Error while awaiting in-flight ${JOB_NAME} during stop: ${error.message}`,
          );
        } finally {
          delete global.cronJobs[JOB_NAME];
        }
      },
    };
  } catch (error) {
    logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  }
};

process.nextTick(startJob);

module.exports = {
  fixCorruptedRawData,
  JOB_NAME,
};
