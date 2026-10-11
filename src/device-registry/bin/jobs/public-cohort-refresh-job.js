/**
 * public-cohort-refresh-job.js
 *
 * Runs weekly and rebuilds the public cohort — up to N public devices from
 * every lowest-level Grid (see utils/public-cohort.util.js for the selection
 * rules). Members that have been offline for longer than the configured
 * window are swapped for another eligible device from the same Grid, or
 * dropped when there is none.
 *
 * Also invoked on demand by POST /cohorts/public/refresh and after a
 * PUT /cohorts/public/config, so a config change does not wait for the next
 * weekly run.
 */

const constants = require("@config/constants");
const os = require("os");
const cron = require("node-cron");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/public-cohort-refresh-job`,
);
const { logText } = require("@utils/shared");
const JobLockModel = require("@models/JobLock");
const publicCohortUtil = require("@utils/public-cohort.util");

const TENANT = constants.DEFAULT_TENANT || "airqo";
const JOB_NAME = "public-cohort-refresh-job";
const JOB_SCHEDULE = "20 2 * * 1"; // Mondays at 02:20

const POD_ID = process.env.HOSTNAME || os.hostname();
const LOCK_TTL_SECONDS = 15 * 60;

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
      { upsert: true, new: true, rawResult: false },
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

let isJobRunning = false;

/**
 * @returns the util's result object, or null when the run was skipped because
 * another refresh is already in progress.
 */
async function runPublicCohortRefreshJob(tenant = TENANT) {
  if (isJobRunning) {
    logText(`${JOB_NAME} -- already running, skipping this execution`);
    return null;
  }
  isJobRunning = true;

  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logText(`${JOB_NAME} -- skipping run: another instance holds the lock`);
    isJobRunning = false;
    return null;
  }

  try {
    const result = await publicCohortUtil.refresh(tenant);
    if (result.success) {
      const {
        total_devices,
        lowest_level_grids,
        under_represented_grids,
        added,
        removed,
      } = result.data;
      logText(
        `${JOB_NAME} -- ${total_devices} device(s) across ${lowest_level_grids} grid(s), ${under_represented_grids} under-represented, +${added} / -${removed}`,
      );
    }
    return result;
  } finally {
    await releaseLock(tenant);
    isJobRunning = false;
  }
}

cron.schedule(JOB_SCHEDULE, () => {
  runPublicCohortRefreshJob().catch((error) => {
    logger.error(`🐛🐛 ${JOB_NAME} -- run failed: ${error.message}`);
  });
});

logText(`${JOB_NAME} -- scheduled (${JOB_SCHEDULE})`);

module.exports = { runPublicCohortRefreshJob };
