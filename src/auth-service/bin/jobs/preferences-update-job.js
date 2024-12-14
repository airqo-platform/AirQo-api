const cron = require("node-cron");
const UserModel = require("@models/User");
const mongoose = require("mongoose");
const PreferenceModel = require("@models/Preference");
const SelectedSiteModel = require("@models/SelectedSite");
const constants = require("@config/constants");
const log4js = require("log4js");
const { logText, logObject } = require("@utils/log");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/preference-update-job`
);
const stringify = require("@utils/stringify");
const isEmpty = require("is-empty");
const BATCH_SIZE = 100;

// Default preference object
const defaultPreference = {
  pollutant: "pm2_5",
  frequency: "hourly",
  startDate: new Date(new Date().setDate(new Date().getDate() - 14)),
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
  airqloud_id: constants.DEFAULT_AIRQLOUD || "NA",
  grid_id: constants.DEFAULT_GRID || "NA",
  network_id: constants.DEFAULT_NETWORK || "NA",
  group_id: constants.DEFAULT_GROUP || "NA",
};

// Function to get selected sites based on the specified method
const getSelectedSites = async (method = "featured") => {
  try {
    let selectedSites;
    if (method === "featured") {
      selectedSites = await SelectedSiteModel("airqo")
        .find({ isFeatured: true })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean();
    } else {
      selectedSites = await SelectedSiteModel("airqo")
        .find()
        .sort({ createdAt: -1 })
        .limit(4)
        .lean();
    }
    const modifiedSelectedSites = selectedSites.map((site) => ({
      ...site,
      _id: site.site_id || null,
    }));
    return modifiedSelectedSites;
  } catch (error) {
    logger.error(`🐛🐛 Error fetching selected sites: ${stringify(error)}`);
    return [];
  }
};

const updatePreferences = async (siteSelectionMethod = "featured") => {
  try {
    const batchSize = BATCH_SIZE;
    let skip = 0;

    // Fetch selected sites data
    const selectedSites = await getSelectedSites(siteSelectionMethod);

    if (isEmpty(selectedSites) || selectedSites.length < 4) {
      logger.error("☹️☹️ No selected sites found. Aborting preference update.");
      return;
    }

    // Specify the group_id you want to use
    const defaultGroupId = mongoose.Types.ObjectId("64f54e4621d9b90013925a08");

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

      for (const user of users) {
        const userIdStr = user._id.toString();
        const preference = preferencesMap.get(userIdStr);

        // Prepare the default preference object with the specific group_id
        const defaultPreferenceWithGroupId = {
          ...defaultPreference,
          user_id: user._id,
          group_id: defaultGroupId,
          selected_sites: selectedSites,
        };

        if (!preference) {
          // No preference exists, create a new one
          await PreferenceModel("airqo")
            .create(defaultPreferenceWithGroupId)
            .catch((error) => {
              logger.error(
                `🐛🐛 Failed to create preference for user ${userIdStr}: ${stringify(
                  error
                )}`
              );
            });
        } else if (isEmpty(preference.selected_sites)) {
          // Preference exists but selected_sites is empty, update it
          await PreferenceModel("airqo")
            .findOneAndUpdate(
              {
                user_id: user._id,
                group_id: defaultGroupId,
              },
              {
                $set: defaultPreferenceWithGroupId,
              },
              {
                new: true,
                upsert: true, // Add this to handle cases where the document might not exist
                setDefaultsOnInsert: true, // Ensures default values are applied when upserting
              }
            )
            .catch((error) => {
              logger.error(
                `🐛🐛 Failed to update preference for user ${userIdStr}: ${stringify(
                  error
                )}`
              );
            });
        }
      }

      skip += batchSize;
    }
  } catch (error) {
    logObject("error", error);
    logger.error(`🐛🐛 Error in updatePreferences: ${stringify(error)}`);
  }
};

const schedule = "30 * * * *"; // At minute 30 of every hour
cron.schedule(schedule, () => updatePreferences("featured"), {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
