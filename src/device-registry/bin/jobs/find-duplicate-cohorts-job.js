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
const LOCK_TTL_SECONDS = 110 * 60; // 110 min (within 2-hour window)
const POD_ID = process.env.HOSTNAME || os.hostname();
const DUPLICATE_TAG = "duplicate";

const acquireLock = async (tenant) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  try {
    const result = await JobLockModel(tenant).findOneAndUpdate(
      {
        jobName: JOB_NAME,
        $or: [{ jobName: { $exists: false } }, { expiresAt: { $lte: now } }],
      },
      {
        $setOnInsert: {
          jobName: JOB_NAME,
          acquiredBy: POD_ID,
          acquiredAt: now,
          expiresAt,
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

const buildDeviceSetKey = (deviceIds) =>
  deviceIds
    .map((id) => id.toString())
    .sort()
    .join(",");

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

    const allCohorts = await CohortModel(tenant)
      .find({ name: { $not: /^coh_user_/i } })
      .select("_id name createdAt cohort_tags")
      .lean();

    if (allCohorts.length === 0) {
      logger.info(`[${POD_ID}] No cohorts found for tenant ${tenant}.`);
      return;
    }

    // Build cohortId -> { cohort, deviceSetKey }
    const cohortDeviceMap = new Map();
    for (const cohort of allCohorts) {
      const devices = await DeviceModel(tenant)
        .find({ cohorts: cohort._id })
        .select("_id")
        .lean();
      if (devices.length === 0) continue; // empty cohorts are not duplicates
      cohortDeviceMap.set(cohort._id.toString(), {
        cohort,
        key: buildDeviceSetKey(devices.map((d) => d._id)),
      });
    }

    // Group cohorts by device set key
    const deviceSetGroups = new Map();
    for (const [, value] of cohortDeviceMap) {
      const group = deviceSetGroups.get(value.key) || [];
      group.push(value.cohort);
      deviceSetGroups.set(value.key, group);
    }

    let taggedCount = 0;
    let untaggedCount = 0;

    for (const [, cohortGroup] of deviceSetGroups) {
      if (cohortGroup.length < 2) {
        // Remove any stale duplicate tag
        const cohort = cohortGroup[0];
        if (cohort.cohort_tags && cohort.cohort_tags.includes(DUPLICATE_TAG)) {
          await CohortModel(tenant).findByIdAndUpdate(cohort._id, {
            $pull: { cohort_tags: DUPLICATE_TAG },
          });
          untaggedCount++;
          logger.info(
            `[${POD_ID}] Removed stale '${DUPLICATE_TAG}' tag from ${cohort.name}`,
          );
        }
        continue;
      }

      // Oldest first → oldest is the original
      cohortGroup.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const [original, ...duplicates] = cohortGroup;

      // Ensure original is NOT tagged
      if (
        original.cohort_tags &&
        original.cohort_tags.includes(DUPLICATE_TAG)
      ) {
        await CohortModel(tenant).findByIdAndUpdate(original._id, {
          $pull: { cohort_tags: DUPLICATE_TAG },
        });
        untaggedCount++;
        logger.info(
          `[${POD_ID}] Removed '${DUPLICATE_TAG}' tag from original ${original.name}`,
        );
      }

      // Tag newer cohorts
      for (const dup of duplicates) {
        const alreadyTagged =
          dup.cohort_tags && dup.cohort_tags.includes(DUPLICATE_TAG);
        if (!alreadyTagged) {
          await CohortModel(tenant).findByIdAndUpdate(dup._id, {
            $addToSet: { cohort_tags: DUPLICATE_TAG },
          });
          taggedCount++;
          logger.info(
            `[${POD_ID}] Tagged ${dup.name} (${dup._id}) as '${DUPLICATE_TAG}' ` +
              `(original: ${original.name} [${original._id}])`,
          );
        }
      }
    }

    logger.info(
      `[${POD_ID}] ${JOB_NAME}-${tenant} complete. Tagged: ${taggedCount}, Untagged stale: ${untaggedCount}.`,
    );
  } catch (error) {
    logger.error(`🐛🐛 Error in ${JOB_NAME}-${tenant}: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

const schedule = "0 */2 * * *"; // Every 2 hours

if (constants.FIND_DUPLICATE_COHORTS_SCHEDULER_ENABLED !== false) {
  cron.schedule(
    schedule,
    async () => {
      await findDuplicateCohorts("airqo");
    },
    {
      scheduled: true,
      timezone: "Africa/Nairobi",
    },
  );

  process.on("SIGTERM", async () => {
    logger.warn(
      `[${POD_ID}] SIGTERM received — releasing lock and shutting down.`,
    );
    await releaseLock("airqo");
  });

  process.on("SIGINT", async () => {
    logger.warn(
      `[${POD_ID}] SIGINT received — releasing lock and shutting down.`,
    );
    await releaseLock("airqo");
  });
}

module.exports = findDuplicateCohorts;
