const cron = require("node-cron");
const moment = require("moment-timezone");
const constants = require("@config/constants");
const UserUsageDailyModel = require("@models/UserUsageDaily");
const usageUtil = require("@utils/usage.util");
const { acquireCronLock } = require("@utils/common/cron-lock.util");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/usage-rollup-job script`,
);

const SCOPES = ["all", "external"];
const jobName = "usage-rollup-job";

/**
 * Daily housekeeping for the usage collections:
 *  1. warm yesterday's per-day summary and last month's summary so admin
 *     dashboards read cached documents;
 *  2. compact daily documents older than USAGE_DETAIL_RETENTION_MONTHS by
 *     dropping their per-page/endpoint breakdown (totals and hourly
 *     histograms stay). Monthly summaries for those months are cached first,
 *     so top-pages history survives the compaction.
 */
const runUsageRollup = async ({ tenant, useLock = true } = {}) => {
  const activeTenant = (tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase();
  const result = { warmed_days: 0, warmed_months: 0, compacted_docs: 0 };
  try {
    if (useLock && !(await acquireCronLock(activeTenant, jobName))) return result;

    const yesterday = moment.utc().subtract(1, "day").format("YYYY-MM-DD");
    const lastMonth = moment.utc().subtract(1, "month").format("YYYY-MM");
    for (const scope of SCOPES) {
      await usageUtil.getDailyTotals(activeTenant, yesterday, yesterday, scope);
      result.warmed_days += 1;
      await usageUtil.getMonthly(activeTenant, lastMonth, scope);
      result.warmed_months += 1;
    }

    const cutoff = moment
      .utc()
      .subtract(constants.USAGE_DETAIL_RETENTION_MONTHS, "months")
      .startOf("month")
      .format("YYYY-MM-DD");
    const Daily = UserUsageDailyModel(activeTenant);
    const detailed = {
      tenant: activeTenant,
      day: { $lt: cutoff },
      $or: [{ pages: { $exists: true } }, { api: { $exists: true } }],
    };
    const days = await Daily.distinct("day", detailed);
    const months = [...new Set(days.map((d) => d.slice(0, 7)))];
    for (const month of months) {
      for (const scope of SCOPES) {
        await usageUtil.getMonthly(activeTenant, month, scope);
        result.warmed_months += 1;
      }
    }
    if (months.length) {
      const compacted = await Daily.updateMany(detailed, {
        $unset: { pages: "", api: "" },
      });
      // mongoose 5 reports `nModified`; newer drivers report `modifiedCount`.
      result.compacted_docs = compacted.nModified ?? compacted.modifiedCount ?? 0;
    }

    logger.info(`usage rollup finished: ${JSON.stringify(result)}`);
  } catch (error) {
    logger.error(`usage rollup failed: ${error.message}`);
  }
  return result;
};

global.cronJobs = global.cronJobs || {};

if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
  // 02:30 Africa/Nairobi: yesterday (UTC) is complete and traffic is low.
  global.cronJobs[jobName] = cron.schedule(
    "30 2 * * *",
    () => runUsageRollup(),
    { scheduled: true, timezone: "Africa/Nairobi" },
  );
}

module.exports = { runUsageRollup };
