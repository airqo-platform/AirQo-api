const cron = require("node-cron");
const UserModel = require("@models/User");
const PreferenceModel = require("@models/Preference");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/preference-update-job`
);
const stringify = require("@utils/stringify");
const isEmpty = require("is-empty");

// Predefined array of 4 site IDs
const defaultSiteIds = constants.SELECTED_SITES;

const updatePreferences = async () => {
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

      // Prepare bulk operations
      const bulkOperations = [];

      // Fetch existing preferences for users in batch
      const userIds = users.map((user) => user._id);
      const preferences = await PreferenceModel("airqo")
        .find({ user_id: { $in: userIds } })
        .lean();

      const preferencesMap = new Map();
      preferences.forEach((pref) => {
        preferencesMap.set(pref.user_id.toString(), pref);
      });

      users.forEach((user) => {
        const userIdStr = user._id.toString();
        const preference = preferencesMap.get(userIdStr);

        if (!preference) {
          // No preference exists, create a new one
          bulkOperations.push({
            insertOne: {
              document: {
                user_id: user._id,
                selected_sites: defaultSiteIds.map((siteId) => ({
                  _id: siteId,
                  createdAt: new Date(),
                })),
              },
            },
          });
        } else if (isEmpty(preference.selected_sites)) {
          // Preference exists but selected_sites is empty, update it
          bulkOperations.push({
            updateOne: {
              filter: { _id: preference._id },
              update: {
                $set: {
                  selected_sites: defaultSiteIds.map((siteId) => ({
                    _id: siteId,
                    createdAt: new Date(),
                  })),
                },
              },
            },
          });
        }
      });

      if (bulkOperations.length > 0) {
        // Execute bulk operations
        await PreferenceModel("airqo").bulkWrite(bulkOperations);
        logger.info(
          `Executed bulk operations for ${bulkOperations.length} users without selected_sites`
        );
      } else {
        // logger.info("No operations to perform in this batch");
      }

      skip += batchSize;
    }
  } catch (error) {
    logger.error(`Error in updatePreferences: ${stringify(error)}`);
  }
};

const schedule = "30 * * * *"; // At minute 30 of every hour
cron.schedule(schedule, updatePreferences, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
