const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const inactiveThreshold = constants.INACTIVE_THRESHOLD || 2592000000; // 30 days
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/active-status-job script`
);
const {
  winstonLogger,
  mailer,
  stringify,
  date,
  msgs,
  emailTemplates,
  generateFilter,
  handleResponse,
} = require("@utils/common");

const checkStatus = async () => {
  try {
    const thresholdDate = new Date(Date.now() - inactiveThreshold);
    const batchSize = 100;

    // Pass 1 — deactivate users whose most recent activity signal is older
    // than the threshold.
    //
    // Activity priority: lastActiveAt (set by API interactions such as
    // preference reads/writes) takes precedence over lastLogin (set only on
    // explicit authentication). A user is considered inactive when:
    //   • lastActiveAt is set AND older than threshold, OR
    //   • lastActiveAt is absent AND lastLogin is older than threshold or null.
    //
    // Note: skip is intentionally NOT incremented. Once a batch is updated to
    // isActive:false those records fall out of the $ne:false filter, so the
    // next iteration always starts at position 0 of the shrinking eligible set.
    // Incrementing skip would skip records in the remaining pool and miss users.
    while (true) {
      const users = await UserModel("airqo")
        .find({
          isActive: { $ne: false },
          $or: [
            // Has a lastActiveAt signal and it has gone stale.
            { lastActiveAt: { $lt: thresholdDate } },
            // No lastActiveAt — fall back to lastLogin.
            {
              lastActiveAt: null,
              $or: [
                { lastLogin: { $lt: thresholdDate } },
                { lastLogin: null },
              ],
            },
          ],
        })
        .limit(batchSize)
        .select("_id")
        .lean();

      if (users.length === 0) break;

      const userIds = users.map((u) => u._id);
      await UserModel("airqo").updateMany(
        { _id: { $in: userIds } },
        { $set: { isActive: false } }
      );
    }

    // Pass 2 — re-activate users who have shown recent activity (via
    // lastActiveAt, written by the preferences endpoints) but are still
    // carrying isActive:false from a previous deactivation run.
    // Same skip=0 pattern applies — updated users drop out of the filter.
    while (true) {
      const users = await UserModel("airqo")
        .find({
          lastActiveAt: { $gte: thresholdDate },
          isActive: { $ne: true },
        })
        .limit(batchSize)
        .select("_id")
        .lean();

      if (users.length === 0) break;

      const userIds = users.map((u) => u._id);
      await UserModel("airqo").updateMany(
        { _id: { $in: userIds } },
        { $set: { isActive: true } }
      );
    }
  } catch (error) {
    logger.error(`Internal Server Error --- ${stringify(error)}`);
  }
};

global.cronJobs = global.cronJobs || {};
const schedule = "0 0 * * *";
const jobName = "active-status-job";

global.cronJobs[jobName] = cron.schedule(schedule, checkStatus, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
