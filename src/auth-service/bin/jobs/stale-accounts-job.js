const cron = require("node-cron");
const UserModel = require("@models/User");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
const constants = require("@config/constants");
const { mailer, stringify } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/stale-accounts-job script -- ops-alerts`,
);

const STALE_THRESHOLD_DAYS = 365; // 1 year of inactivity triggers alert
const DELETION_GRACE_DAYS = 30; // Days between alert and actual deletion
const FINAL_REMINDER_DAYS = 7; // Days before deletion to send the final warning
const CONCURRENCY_LIMIT = 10;
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
            deletion_final_reminder_sent_at: "",
          },
        },
      );
      logger.info(
        `Cancelled deletion for ${ids.length} account(s) — recent activity detected.`,
      );
    }

    // Pass 1 — Find accounts inactive for over a year that have not yet been
    // flagged, mark them for deletion after the grace period, send the initial
    // courtesy warning email, and raise an ops alert. Both activity signals
    // (lastLogin and lastActiveAt) must be stale or absent before an account
    // is considered truly dormant.
    let totalFlagged = 0;
    while (true) {
      const staleUsers = await UserModel(tenant)
        .find({
          scheduled_for_deletion_at: { $exists: false },
          // Only consider accounts older than the stale threshold. Without this
          // guard, a newly-registered account with null lastLogin/lastActiveAt
          // would match the activity conditions below and be incorrectly flagged.
          createdAt: { $lt: staleThresholdDate },
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
        .select("_id email firstName")
        .lean();

      if (staleUsers.length === 0) break;

      const ids = staleUsers.map((u) => u._id);
      const deletionDateStr = gracePeriodEnd.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      // Send the 30-day courtesy warning to each flagged account. Processed in
      // chunks to limit concurrency; failures are logged and never block the run.
      const emailPromises = [];
      for (const user of staleUsers) {
        emailPromises.push(
          mailer
            .accountScheduledForDeletion({
              firstName: user.firstName,
              email: user.email,
              deletionDate: deletionDateStr,
            })
            .catch((err) =>
              logger.warn(
                `Failed to send deletion warning to account ${user._id}: ${err.message}`,
              ),
            ),
        );
        if (emailPromises.length >= CONCURRENCY_LIMIT) {
          await Promise.allSettled(emailPromises);
          emailPromises.length = 0;
        }
      }
      if (emailPromises.length > 0) {
        await Promise.allSettled(emailPromises);
      }

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

    // Pass 1.5 — Send a final 7-day reminder to accounts whose deletion date
    // is within the next FINAL_REMINDER_DAYS days and who have not yet received
    // this reminder. This gives users one last chance to log in and save their
    // account before it is permanently deleted.
    const finalReminderCutoff = new Date();
    finalReminderCutoff.setDate(
      finalReminderCutoff.getDate() + FINAL_REMINDER_DAYS,
    );

    while (true) {
      const nearingDeletion = await UserModel(tenant)
        .find({
          scheduled_for_deletion_at: {
            $exists: true,
            $lte: finalReminderCutoff,
            $gt: now, // not yet expired — Pass 2 handles those
          },
          deletion_final_reminder_sent_at: { $exists: false },
        })
        .limit(BATCH_SIZE)
        .select("_id email firstName scheduled_for_deletion_at")
        .lean();

      if (nearingDeletion.length === 0) break;

      const reminderPromises = [];
      const reminderIds = [];
      for (const user of nearingDeletion) {
        const deletionDateStr = new Date(
          user.scheduled_for_deletion_at,
        ).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        reminderPromises.push(
          mailer
            .accountDeletionFinalReminder({
              firstName: user.firstName,
              email: user.email,
              deletionDate: deletionDateStr,
            })
            .then(() => {
              reminderIds.push(user._id);
            })
            .catch((err) =>
              logger.warn(
                `Failed to send final deletion reminder to account ${user._id}: ${err.message}`,
              ),
            ),
        );
        if (reminderPromises.length >= CONCURRENCY_LIMIT) {
          await Promise.allSettled(reminderPromises);
          reminderPromises.length = 0;
        }
      }
      if (reminderPromises.length > 0) {
        await Promise.allSettled(reminderPromises);
      }

      if (reminderIds.length > 0) {
        await UserModel(tenant).updateMany(
          { _id: { $in: reminderIds } },
          { $set: { deletion_final_reminder_sent_at: now } },
        );
        logger.info(
          `Sent final deletion reminder to ${reminderIds.length} account(s).`,
        );
      }
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
