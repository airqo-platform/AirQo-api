const moment = require("moment-timezone");
const CronLockModel = require("@models/CronLock");
const constants = require("@config/constants");
const log4js = require("log4js");

const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- cron-lock-util`);

/**
 * First-writer-wins distributed lock for cron jobs. This deployment runs
 * multiple pod replicas and every pod registers its own node-cron schedule
 * independently (no leader election), so without this gate every scheduled
 * tick runs once per pod instead of once total.
 *
 * The lock bucket is minute-granularity rather than tied to each job's own
 * cadence: node-cron's finest resolution is one minute, so all pods
 * triggered by the same scheduled tick always compute the same bucket,
 * regardless of whether the job itself runs hourly, daily, or weekly.
 *
 * Fails CLOSED on unexpected DB errors (e.g. connection issues) — skipping
 * one run is safer than letting every pod run unguarded, and jobs recur.
 *
 * @param {string} tenant  - DB tenant; falls back to the default tenant.
 * @param {string} jobName - Unique identifier for the job (its `jobName`
 *   constant/global.cronJobs key is a good choice).
 * @returns {Promise<boolean>} true if this pod acquired the lock and should run.
 */
const acquireCronLock = async (tenant, jobName) => {
  const CronLock = CronLockModel(tenant);
  const minuteBucket = moment().utc().format("YYYY-MM-DDTHH:mm");
  const lockKey = `${jobName}:${minuteBucket}`;

  try {
    await CronLock.create({ lockKey });
    return true;
  } catch (err) {
    if (err.code === 11000) {
      return false;
    }
    logger.warn(
      `acquireCronLock(${jobName}) failed, failing closed: ${err.message}`,
    );
    return false;
  }
};

module.exports = { acquireCronLock };
