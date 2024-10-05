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

// Default preference object
const defaultPreference = {
  pollutant: "pm2_5",
  frequency: "hourly",
  startDate: new Date(new Date().setDate(new Date().getDate() - 14)), // 2 weeks ago
  endDate: new Date(),
  chartType: "line",
  chartTitle: "Default Chart Title",
  chartSubTitle: "Default Chart Subtitle",
  period: {
    value: "Last 14 days",
    label: "Last 14 days",
    unitValue: 14,
    unit: "day",
  },
  airqloud_id: constants.DEFAULT_AIRQLOUD,
  grid_id: constants.DEFAULT_GRID,
  network_id: constants.DEFAULT_NETWORK,
  group_id: constants.DEFAULT_GROUP,
};

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
        .select("_id user_id selected_sites")
        .lean();

      const preferencesMap = new Map();
      preferences.forEach((pref) => {
        preferencesMap.set(pref.user_id.toString(), pref);
      });

      // Initialize selected_sites data
      const selectedSitesData = defaultSiteIds.map((siteId) => ({
        _id: siteId,
        createdAt: new Date(),
      }));

      users.forEach((user) => {
        const userIdStr = user._id.toString();
        const preference = preferencesMap.get(userIdStr);

        if (!preference) {
          // No preference exists, create a new one
          bulkOperations.push({
            insertOne: {
              document: {
                ...defaultPreference,
                user_id: user._id,
                selected_sites: selectedSitesData,
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
                  ...defaultPreference,
                  selected_sites: selectedSitesData,
                },
              },
            },
          });
        }
      });

      if (bulkOperations.length > 0) {
        // Execute bulk operations
        try {
          await PreferenceModel("airqo").bulkWrite(bulkOperations, {
            ordered: false,
          });
          logger.info(
            `Executed bulk operations for ${bulkOperations.length} users without selected_sites`
          );
        } catch (bulkWriteError) {
          logger.error(
            `🐛🐛 Error in bulk write operation: ${stringify(bulkWriteError)}`
          );
        }
      } else {
        // logger.info("No operations to perform in this batch");
      }

      skip += batchSize;
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in updatePreferences: ${stringify(error)}`);
  }
};

const schedule = "30 * * * *"; // At minute 30 of every hour
cron.schedule(schedule, updatePreferences, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
