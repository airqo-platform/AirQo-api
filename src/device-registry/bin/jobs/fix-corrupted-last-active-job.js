const DeviceModel = require("@models/Device");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- fix-corrupted-last-active-job`,
);
const os = require("os");

const JOB_NAME = "fix-corrupted-last-active";
const LOCK_TTL_SECONDS = 15 * 60; // 15 minutes
const POD_ID = process.env.HOSTNAME || os.hostname();
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

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
          // Allow the same pod to reclaim its own lock after a restart within
          // the TTL window — without this, the upsert hits a duplicate key and
          // the pod can never re-acquire a lock it already held.
          { acquiredBy: POD_ID },
        ],
      },
      {
        $set: {
          acquiredBy: POD_ID,
          acquiredAt: now,
          expiresAt,
        },
        $setOnInsert: {
          jobName: JOB_NAME,
        },
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

const isFutureOrInvalid = (value) => {
  if (!value) return true;
  const time = new Date(value).getTime();
  return isNaN(time) || time > Date.now() + MAX_CLOCK_SKEW_MS;
};

/**
 * One-time cleanup: corrects `lastActive` on devices left with a
 * future/corrupted value by the (now-fixed) unvalidated write paths in
 * beta-store-readings-job.js, backup-store-readings-job.js and
 * update-raw-online-status-job.js. A bad lastActive surfaces downstream as
 * transmissionStatus "Invalid Date".
 *
 * Safe to run on every startup: it first counts affected devices and returns
 * immediately when none are found, so a clean fleet costs one query.
 */
const fixCorruptedLastActive = async (tenant) => {
  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logger.info(
      `[${POD_ID}] Could not acquire lock for ${JOB_NAME} — another pod is running it.`,
    );
    return;
  }

  try {
    const Device = DeviceModel(tenant);
    const filter = {
      lastActive: { $gt: new Date(Date.now() + MAX_CLOCK_SKEW_MS) },
    };

    const total = await Device.countDocuments(filter);

    if (total === 0) {
      logger.info(
        `[${POD_ID}] ${JOB_NAME}: no devices with a future lastActive found — nothing to fix.`,
      );
      return;
    }

    logger.info(
      `[${POD_ID}] ${JOB_NAME}: found ${total} device(s) with a corrupted lastActive. Fixing...`,
    );

    const devices = await Device.find(filter)
      .select("_id lastActive lastRawData onlineStatusAccuracy.lastUpdate")
      .lean();

    let fixed = 0;
    let manualReview = 0;

    for (const device of devices) {
      const fallback = [
        device.lastRawData,
        device.onlineStatusAccuracy?.lastUpdate,
      ]
        .filter((value) => !isFutureOrInvalid(value))
        .sort((a, b) => new Date(b) - new Date(a))[0];

      if (!fallback) {
        manualReview += 1;
        logger.warn(
          `[${POD_ID}] ${JOB_NAME}: device ${device._id} has no valid fallback timestamp, needs manual review.`,
        );
        continue;
      }

      await Device.collection.updateOne(
        { _id: device._id },
        { $set: { lastActive: new Date(fallback) } },
      );
      fixed += 1;
    }

    logger.info(
      `[${POD_ID}] ${JOB_NAME}: done. Fixed: ${fixed}, needs manual review: ${manualReview}.`,
    );
  } catch (error) {
    logger.error(`[${POD_ID}] ${JOB_NAME} error: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

module.exports = fixCorruptedLastActive;
