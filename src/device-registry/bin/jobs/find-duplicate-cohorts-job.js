const cron = require("node-cron");
const CohortModel = require("@models/Cohort");
const DeviceModel = require("@models/Device");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- find-duplicate-cohorts-job`,
);
const os = require("os");

const JOB_NAME = "find-duplicate-cohorts";
const LOCK_TTL_SECONDS = 110 * 60; // 110 minutes
const POD_ID = process.env.HOSTNAME || os.hostname();
const DUPLICATE_TAG = "duplicate";

const acquireLock = async (tenant) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  try {
    const result = await JobLockModel(tenant).findOneAndUpdate(
      {
        $or: [
          // Claim an expired lock for this job (the normal takeover path)
          { jobName: JOB_NAME, expiresAt: { $lte: now } },
          // Recover a malformed lock document that is missing expiresAt
          { jobName: JOB_NAME, expiresAt: { $exists: false } },
          // Recover a document that is missing jobName entirely (defensive)
          { jobName: { $exists: false } },
        ],
      },
      {
        // $set overwrites fields on both insert (upsert) and update (expired doc),
        // so an expired lock held by a crashed pod is correctly taken over.
        $set: {
          acquiredBy: POD_ID,
          acquiredAt: now,
          expiresAt,
        },
        // $setOnInsert only fires when MongoDB creates a new document via upsert,
        // ensuring jobName is written on first creation without conflicting with $set.
        $setOnInsert: {
          jobName: JOB_NAME,
        },
      },
      { upsert: true, new: true, rawResult: false },
    );
    return result && result.acquiredBy === POD_ID;
  } catch (error) {
    if (error.code === 11000) return false;
    logger.error(`🐛🐛 Lock acquisition error: ${error.message}`);
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
    logger.error(`🐛🐛 Lock release error: ${error.message}`);
  }
};

/**
 * Builds a canonical string key for a sorted set of device IDs.
 * Used to identify cohorts that share the exact same device membership.
 */
const buildDeviceSetKey = (deviceIds) => {
  return deviceIds
    .map((id) => id.toString())
    .sort()
    .join(",");
};

/**
 * Main job: scan all cohorts, find duplicate device sets,
 * and tag newer cohorts with "duplicate". The oldest cohort
 * in each duplicate group is treated as the original.
 */
const findDuplicateCohorts = async (tenant) => {
  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logger.info(
      `[${POD_ID}] Could not acquire lock for ${JOB_NAME}-${tenant}. Skipping.`,
    );
    return;
  }

  try {
    logger.info(`[${POD_ID}] Starting ${JOB_NAME} for tenant: ${tenant}`);

    // Fetch all non-user cohorts
    const allCohorts = await CohortModel(tenant)
      .find({ name: { $not: /^coh_user_/i } })
      .select("_id name createdAt cohort_tags")
      .lean();

    if (allCohorts.length === 0) {
      logger.info(`[${POD_ID}] No cohorts found for tenant ${tenant}.`);
      return;
    }

    // Fetch all device->cohort assignments in a single aggregation to avoid N+1 queries.
    // Result: [{ _id: cohortId, deviceIds: [ObjectId, ...] }]
    const cohortIds = allCohorts.map((c) => c._id);
    const devicesByCohort = await DeviceModel(tenant).aggregate([
      { $match: { cohorts: { $in: cohortIds } } },
      { $unwind: "$cohorts" },
      { $match: { cohorts: { $in: cohortIds } } },
      {
        $group: {
          _id: "$cohorts",
          deviceIds: { $push: "$_id" },
        },
      },
    ]);

    // Index aggregation results by cohort ID string for O(1) lookup
    const deviceIdsByCohortId = new Map();
    for (const row of devicesByCohort) {
      deviceIdsByCohortId.set(row._id.toString(), row.deviceIds);
    }

    // Build a map of cohortId -> { cohort, deviceSetKey }
    const cohortDeviceMap = new Map();

    for (const cohort of allCohorts) {
      const deviceIds = deviceIdsByCohortId.get(cohort._id.toString());

      // Skip cohorts with no devices — empty cohorts are not considered duplicates
      if (!deviceIds || deviceIds.length === 0) continue;

      cohortDeviceMap.set(cohort._id.toString(), {
        cohort,
        key: buildDeviceSetKey(deviceIds),
      });
    }

    // Group cohorts by their device set key
    const deviceSetGroups = new Map(); // key -> cohort[]
    for (const [, value] of cohortDeviceMap) {
      const group = deviceSetGroups.get(value.key) || [];
      group.push(value.cohort);
      deviceSetGroups.set(value.key, group);
    }

    let taggedCount = 0;
    let untaggedCount = 0;

    // Collect all tag additions and removals first, then flush in one bulkWrite
    // to avoid serialising individual awaited writes for every cohort.
    const bulkOps = [];

    for (const [, cohortGroup] of deviceSetGroups) {
      if (cohortGroup.length < 2) {
        // Single cohort with this device set — remove stale duplicate tag if present
        const cohort = cohortGroup[0];
        if (cohort.cohort_tags && cohort.cohort_tags.includes(DUPLICATE_TAG)) {
          bulkOps.push({
            updateOne: {
              filter: { _id: cohort._id },
              update: { $pull: { cohort_tags: DUPLICATE_TAG } },
            },
          });
          untaggedCount++;
          logger.info(
            `[${POD_ID}] Queuing removal of stale '${DUPLICATE_TAG}' tag from cohort ${cohort.name} (${cohort._id})`,
          );
        }
        continue;
      }

      // Sort ascending by createdAt, with _id as a stable tie-breaker.
      // ObjectId bytes 0-3 encode creation time, so _id string comparison
      // produces a deterministic order when two cohorts share an identical timestamp.
      cohortGroup.sort((a, b) => {
        const timeDiff = new Date(a.createdAt) - new Date(b.createdAt);
        if (timeDiff !== 0) return timeDiff;
        return a._id.toString().localeCompare(b._id.toString());
      });

      const [original, ...duplicates] = cohortGroup;

      // Ensure the original cohort is NOT tagged as duplicate
      if (
        original.cohort_tags &&
        original.cohort_tags.includes(DUPLICATE_TAG)
      ) {
        bulkOps.push({
          updateOne: {
            filter: { _id: original._id },
            update: { $pull: { cohort_tags: DUPLICATE_TAG } },
          },
        });
        untaggedCount++;
        logger.info(
          `[${POD_ID}] Queuing removal of '${DUPLICATE_TAG}' tag from original cohort ${original.name} (${original._id})`,
        );
      }

      // Queue tag additions for all newer cohorts in the group
      for (const dup of duplicates) {
        const alreadyTagged =
          dup.cohort_tags && dup.cohort_tags.includes(DUPLICATE_TAG);
        if (!alreadyTagged) {
          bulkOps.push({
            updateOne: {
              filter: { _id: dup._id },
              update: { $addToSet: { cohort_tags: DUPLICATE_TAG } },
            },
          });
          taggedCount++;
          logger.info(
            `[${POD_ID}] Queuing '${DUPLICATE_TAG}' tag for cohort ${dup.name} (${dup._id}) ` +
              `(duplicate of original: ${original.name} [${original._id}])`,
          );
        }
      }
    }

    // Flush all queued updates in a single round-trip
    if (bulkOps.length > 0) {
      await CohortModel(tenant).bulkWrite(bulkOps, { ordered: false });
    }

    logger.info(
      `[${POD_ID}] ${JOB_NAME}-${tenant} complete. ` +
        `Newly tagged: ${taggedCount}, Stale tags removed: ${untaggedCount}.`,
    );
  } catch (error) {
    logger.error(`🐛🐛 Error in ${JOB_NAME}-${tenant}: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

// Every 2 hours at minute 0
const schedule = "0 */2 * * *";

// Module-scoped tenant variable so SIGTERM/SIGINT handlers always release
// the lock for the tenant that was actually used in the last job run.
let activeTenant = constants.DEFAULT_TENANT || "airqo";

if (constants.FIND_DUPLICATE_COHORTS_SCHEDULER_ENABLED === true) {
  const task = cron.schedule(
    schedule,
    async () => {
      activeTenant = constants.DEFAULT_TENANT || "airqo";
      await findDuplicateCohorts(activeTenant);
    },
    {
      scheduled: true,
      timezone: "Africa/Nairobi",
    },
  );

  // Register with global.cronJobs so the graceful shutdown handler in
  // server.js can stop this task alongside all other cron jobs.
  if (!global.cronJobs) {
    global.cronJobs = {};
  }
  global.cronJobs[JOB_NAME] = task;

  process.on("SIGTERM", async () => {
    logger.warn(
      `[${POD_ID}] SIGTERM received — releasing lock and shutting down.`,
    );
    if (activeTenant) {
      await releaseLock(activeTenant);
    }
  });

  process.on("SIGINT", async () => {
    logger.warn(
      `[${POD_ID}] SIGINT received — releasing lock and shutting down.`,
    );
    if (activeTenant) {
      await releaseLock(activeTenant);
    }
  });
}

module.exports = findDuplicateCohorts;
