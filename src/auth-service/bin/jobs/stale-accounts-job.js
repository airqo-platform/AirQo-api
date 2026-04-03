const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const { stringify } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/stale-accounts-job script -- ops-alerts`,
);

const STALE_THRESHOLD_DAYS = 365; // 1 year of inactivity triggers alert
const DELETION_GRACE_DAYS = 30; // Days between alert and actual deletion
const BATCH_SIZE = 100;

const processStaleAccounts = async () => {
  try {
    const tenant = (constants.DEFAULT_TENANT || "airqo").toLowerCase();
    const now = new Date();

    const staleThresholdDate = new Date();
    staleThresholdDate.setDate(staleThresholdDate.getDate() - STALE_THRESHOLD_DAYS);

    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + DELETION_GRACE_DAYS);

    // Pass 0 — Unmark accounts that became active again after being scheduled
    // for deletion. If either lastLogin or lastActiveAt is recent the account
    // should be spared regardless of the scheduled_for_deletion_at value.
    while (true) {
      const reactivated = await UserModel(tenant)
        .find({
          scheduled_for_deletion_at: { $exists: true },
          $or: [
            { lastLogin: { $gte: staleThresholdDate } },
            { lastActiveAt: { $gte: staleThresholdDate } },
          ],
        })
        .limit(BATCH_SIZE)
        .select("_id")
        .lean();

      if (reactivated.length === 0) break;

      const ids = reactivated.map((u) => u._id);
      await UserModel(tenant).updateMany(
        { _id: { $in: ids } },
        {
          $unset: {
            scheduled_for_deletion_at: "",
            stale_account_alert_sent_at: "",
          },
        },
      );
      logger.info(
        `Cancelled deletion for ${ids.length} account(s) — recent activity detected.`,
      );
    }

    // Pass 1 — Find accounts inactive for over a year that have not yet been
    // flagged, mark them for deletion after the grace period, and raise an ops
    // alert. Both activity signals (lastLogin and lastActiveAt) must be stale
    // or absent before an account is considered truly dormant.
    let totalFlagged = 0;
    while (true) {
      const staleUsers = await UserModel(tenant)
        .find({
          scheduled_for_deletion_at: { $exists: false },
          $and: [
            {
              $or: [
                { lastLogin: null },
                { lastLogin: { $lt: staleThresholdDate } },
              ],
            },
            {
              $or: [
                { lastActiveAt: null },
                { lastActiveAt: { $lt: staleThresholdDate } },
              ],
            },
          ],
        })
        .limit(BATCH_SIZE)
        .select("_id email")
        .lean();

      if (staleUsers.length === 0) break;

      const ids = staleUsers.map((u) => u._id);
      await UserModel(tenant).updateMany(
        { _id: { $in: ids } },
        {
          $set: {
            scheduled_for_deletion_at: gracePeriodEnd,
            stale_account_alert_sent_at: now,
          },
        },
      );
      totalFlagged += ids.length;
    }

    if (totalFlagged > 0) {
      logger.error(
        `🚨 STALE ACCOUNTS ALERT: ${totalFlagged} account(s) have been inactive for over ` +
          `${STALE_THRESHOLD_DAYS} days and are now scheduled for deletion on ` +
          `${gracePeriodEnd.toISOString().split("T")[0]}. ` +
          `Review the accounts with { scheduled_for_deletion_at: { $exists: true } } ` +
          `before the grace period expires.`,
      );
    }

    // Pass 2 — Permanently delete accounts whose grace period has elapsed.
    // By this point they have been inactive for at least 1 year + 30 days and
    // showed no activity during the grace window.
    let totalDeleted = 0;
    while (true) {
      const toDelete = await UserModel(tenant)
        .find({ scheduled_for_deletion_at: { $lte: now } })
        .limit(BATCH_SIZE)
        .select("_id email")
        .lean();

      if (toDelete.length === 0) break;

      const ids = toDelete.map((u) => u._id);
      const emails = toDelete.map((u) => u.email).filter(Boolean);
      await UserModel(tenant).deleteMany({ _id: { $in: ids } });
      totalDeleted += ids.length;

      const preview = emails.slice(0, 5).join(", ");
      const overflow = emails.length > 5 ? ` and ${emails.length - 5} more` : "";
      logger.error(
        `🗑️ Deleted ${ids.length} stale account(s): ${preview}${overflow}`,
      );
    }

    if (totalDeleted > 0) {
      logger.error(
        `🗑️ Stale-accounts-job: ${totalDeleted} account(s) permanently deleted this run.`,
      );
    }
  } catch (error) {
    logger.error(`Error in processStaleAccounts job: ${stringify(error)}`);
  }
};

global.cronJobs = global.cronJobs || {};
const jobName = "stale-accounts-job";

if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
  // Run weekly on Sunday at 03:00 Africa/Nairobi. Weekly cadence is sufficient
  // for year-scale staleness and keeps deletion load low.
  global.cronJobs[jobName] = cron.schedule(
    "0 3 * * 0",
    processStaleAccounts,
    {
      scheduled: true,
      timezone: "Africa/Nairobi",
    },
  );
}
