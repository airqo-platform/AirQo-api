const DeviceModel = require("@models/Device");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- clear-deployment-type-job`,
);
const os = require("os");

const JOB_NAME = "clear-deployment-type";
const LOCK_TTL_SECONDS = 30 * 60; // 30 minutes
const POD_ID = process.env.HOSTNAME || os.hostname();

// Mirrors the constant in models/Device.js — kept in sync via VALID_DEVICE_STATUSES.
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
        // $set runs on both INSERT and UPDATE — ensures expired lock documents
        // are overwritten with the current pod's ownership values.
        $set: {
          acquiredBy: POD_ID,
          acquiredAt: now,
          expiresAt,
        },
        // $setOnInsert only runs on INSERT — keeps jobName immutable on updates.
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

/**
 * One-time cleanup: unsets deployment_type on all devices whose status
 * indicates they are not actively deployed. Uses collection.updateMany to
 * bypass the Mongoose pre-hook (which would attempt a mobility/deployment_type
 * sync and produce spurious writes).
 *
 * Safe to run multiple times — subsequent runs find no matching documents
 * and exit immediately.
 */
const clearDeploymentType = async (tenant) => {
  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logger.info(
      `[${POD_ID}] Could not acquire lock for ${JOB_NAME} — another pod is running it.`,
    );
    return;
  }

  try {
    const filter = {
      status: { $in: UN_DEPLOYED_STATUSES },
      deployment_type: { $exists: true },
    };

    const total = await DeviceModel(tenant).countDocuments(filter);

    if (total === 0) {
      logger.info(
        `[${POD_ID}] ${JOB_NAME}: no un-deployed devices with deployment_type found — nothing to clean.`,
      );
      return;
    }

    logger.info(
      `[${POD_ID}] ${JOB_NAME}: found ${total} device(s) to clean. Unsetting deployment_type...`,
    );

    // Go directly to the MongoDB driver to bypass all Mongoose middleware.
    const result = await DeviceModel(tenant).collection.updateMany(filter, {
      $unset: { deployment_type: "" },
    });

    logger.info(
      `[${POD_ID}] ${JOB_NAME}: done. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}.`,
    );
  } catch (error) {
    logger.error(`[${POD_ID}] ${JOB_NAME} error: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

module.exports = clearDeploymentType;
