const cron = require("node-cron");
const UserModel = require("@models/User");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
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
        .select("_id")
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
      logger.warn(
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
    //
    // Neither ClientSchema nor AccessTokenSchema define pre-deleteMany hooks so
    // Mongoose will not cascade deletions automatically. We perform explicit
    // cascading: AccessTokens → Clients → Users, in that order, to avoid
    // leaving orphaned documents behind.
    let totalDeleted = 0;
    while (true) {
      const toDelete = await UserModel(tenant)
        .find({ scheduled_for_deletion_at: { $lte: now } })
        .limit(BATCH_SIZE)
        .select("_id")
        .lean();

      if (toDelete.length === 0) break;

      const userIds = toDelete.map((u) => u._id);

      // Resolve client IDs owned by these users so we can clean up tokens first.
      const clients = await ClientModel(tenant)
        .find({ user_id: { $in: userIds } })
        .select("_id")
        .lean();
      const clientIds = clients.map((c) => c._id);

      if (clientIds.length > 0) {
        await AccessTokenModel(tenant).deleteMany({
          client_id: { $in: clientIds },
        });
        await ClientModel(tenant).deleteMany({ _id: { $in: clientIds } });
      }

      await UserModel(tenant).deleteMany({ _id: { $in: userIds } });
      totalDeleted += userIds.length;

      logger.warn(
        `🗑️ Deleted ${userIds.length} stale account(s) and ${clientIds.length} associated client(s)/token(s).`,
      );
    }

    if (totalDeleted > 0) {
      logger.warn(
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
