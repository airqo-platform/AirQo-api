const cron = require("node-cron");
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

    while (true) {
      const users = await UserModel("airqo")
        .find()
        .limit(batchSize)
        .skip(skip)
        .select("_id")
        .lean();

      if (users.length === 0) {
        break;
      }

      // Fetch existing preferences for users in batch
      const userIds = users.map((user) => user._id);
      const preferences = await PreferenceModel("airqo")
        .find({ user_id: { $in: userIds } })
        .select("_id user_id selected_sites")
        .lean();

      const preferencesMap = new Map();
      preferences.forEach((pref) => {
        preferencesMap.set(pref.user_id.toString(), pref);
      });

      // Collect IDs of users without selected_sites
      const usersWithoutSelectedSites = users
        .filter((user) => {
          const preference = preferencesMap.get(user._id.toString());
          return !preference || isEmpty(preference.selected_sites);
        })
        .map((user) => user._id.toString());

      // Log the array of user IDs and the total count
      const countWithoutSelectedSites = usersWithoutSelectedSites.length;
      logger.info(
        `💀💀 Users without selected_sites: ${stringify(
          usersWithoutSelectedSites
        )}`
      );
      logger.info(
        `💔💔 Total count of users without selected_sites: ${countWithoutSelectedSites}`
      );

      skip += batchSize;
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
