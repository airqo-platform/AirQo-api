const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const { stringify } = require("@utils/common");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- token-strategy-migration-job`
);

const BATCH_SIZE = 100;

let isJobRunning = false;

const migrateTokenStrategiesToDefault = async (tenant) => {
  if (isJobRunning) {
    logger.warn(
      "Token strategy migration job is already running. Skipping this execution."
    );
    return;
  }
  isJobRunning = true;

  const tenantId = tenant || constants.DEFAULT_TENANT || "airqo";
  try {
    logger.info(
      "🚀 Starting token strategy migration job to update users to default..."
    );

    const filter = {
      preferredTokenStrategy: {
        $ne: constants.TOKEN_STRATEGIES.NO_ROLES_AND_PERMISSIONS,
      },
    };

    const update = {
      $set: {
        preferredTokenStrategy:
          constants.TOKEN_STRATEGIES.NO_ROLES_AND_PERMISSIONS,
      },
    };

    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore) {
      // Find a batch of users with non-default strategies
      const usersToUpdate = await UserModel(tenantId)
        .find(filter)
        .limit(BATCH_SIZE)
        .select("_id")
        .lean();

      if (usersToUpdate.length === 0) {
        hasMore = false;
        continue;
      }

      const userIds = usersToUpdate.map((user) => user._id);

      // Perform the update for the batch
      const result = await UserModel(tenantId).updateMany(
        { _id: { $in: userIds } },
        update
      );

      const updatedCount =
        (typeof result.modifiedCount === "number"
          ? result.modifiedCount
          : result.nModified) || 0;
      totalUpdated += updatedCount;

      logger.info(
        `Batch processed: ${updatedCount} users updated to default strategy.`
      );
    }

    if (totalUpdated > 0) {
      logger.info(
        `✅ Migration complete! Total users updated: ${totalUpdated}`
      );
    } else {
      logger.info(
        "✅ All users are already on the default token strategy. No migration needed."
      );
    }
  } catch (error) {
    logger.error(
      `🐛🐛 Error during token strategy migration: ${stringify(error)}`
    );
  } finally {
    isJobRunning = false;
  }
};

// Schedule to run three times a day: at 6 AM, 1 PM, and 6 PM.
const schedule = "0 6,13,18 * * *";

global.cronJobs = global.cronJobs || {};
const jobName = "token-strategy-migration-job";

global.cronJobs[jobName] = cron.schedule(
  schedule,
  () => migrateTokenStrategiesToDefault(),
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);

module.exports = { migrateTokenStrategiesToDefault };
