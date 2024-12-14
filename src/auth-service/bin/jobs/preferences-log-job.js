const cron = require("node-cron");
const mongoose = require("mongoose");
const UserModel = require("@models/User");
const PreferenceModel = require("@models/Preference");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/preferences-log-job`
);
const stringify = require("@utils/stringify");
const isEmpty = require("is-empty");

const logUserPreferences = async () => {
  try {
    const batchSize = 100;
    let skip = 0;
    let totalCountWithoutSelectedSites = 0;
    let totalUsersProcessed = 0;

    // Use the default group ID
    const defaultGroupId = mongoose.Types.ObjectId(constants.DEFAULT_GROUP);

    while (true) {
      // Fetch users with their group_roles
      const users = await UserModel("airqo")
        .find()
        .limit(batchSize)
        .skip(skip)
        .select("_id email group_roles")
        .lean();

      if (users.length === 0) {
        break;
      }

      // Filter users who are members of the default group
      const validUsers = users.filter(
        (user) =>
          user.group_roles &&
          user.group_roles.some(
            (role) => role.group.toString() === defaultGroupId.toString()
          )
      );

      // Fetch existing preferences for valid users in the default group
      const userIds = validUsers.map((user) => user._id);
      const preferences = await PreferenceModel("airqo")
        .find({
          user_id: { $in: userIds },
          group_id: defaultGroupId,
        })
        .select("_id user_id selected_sites")
        .lean();

      const preferencesMap = new Map();
      preferences.forEach((pref) => {
        preferencesMap.set(pref.user_id.toString(), pref);
      });

      // Collect IDs of users without selected_sites in the default group
      const usersWithoutSelectedSites = validUsers.filter((user) => {
        const preference = preferencesMap.get(user._id.toString());
        return !preference || isEmpty(preference.selected_sites);
      });

      // Aggregate results
      totalCountWithoutSelectedSites += usersWithoutSelectedSites.length;
      totalUsersProcessed += validUsers.length;

      skip += batchSize;
    }

    // Log the aggregated results once after processing all users
    if (totalUsersProcessed > 0) {
      const percentageWithoutSelectedSites = (
        (totalCountWithoutSelectedSites / totalUsersProcessed) *
        100
      ).toFixed(2);

      if (totalCountWithoutSelectedSites > 0) {
        logger.info(
          `💔💔 Total count of users without Customised Locations in the default group: ${totalCountWithoutSelectedSites}, which is ${percentageWithoutSelectedSites}% of processed users.`
        );
      } else {
        logger.info(`😎🎉✅ All users have Customised Locations.`);
      }
    } else {
      logger.info(
        `🤔🤔 No users processed or no users belong to the default group.`
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in logUserPreferences: ${stringify(error)}`);
  }
};

const schedule = "30 */2 * * *"; // At minute 30 of every 2nd hour
cron.schedule(schedule, logUserPreferences, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

module.exports = { logUserPreferences };
