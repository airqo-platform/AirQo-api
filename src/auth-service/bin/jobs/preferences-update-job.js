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

// Function to validate critical default values
const validateDefaultValues = () => {
  const criticalDefaults = [
    { key: "DEFAULT_GROUP", value: constants.DEFAULT_GROUP },
    { key: "DEFAULT_AIRQLOUD", value: constants.DEFAULT_AIRQLOUD },
    { key: "DEFAULT_GRID", value: constants.DEFAULT_GRID },
    { key: "DEFAULT_NETWORK", value: constants.DEFAULT_NETWORK },
  ];

  const missingDefaults = criticalDefaults.filter(
    (item) => isEmpty(item.value) || item.value === undefined
  );

  if (missingDefaults.length > 0) {
    const missingKeys = missingDefaults.map((item) => item.key).join(", ");
    logger.error(
      `🚨 Aborting preference update: Missing critical default values: ${missingKeys}`
    );
    return false;
  }

  return true;
};

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
  airqloud_id: constants.DEFAULT_AIRQLOUD,
  grid_id: constants.DEFAULT_GRID,
  network_id: constants.DEFAULT_NETWORK,
  group_id: constants.DEFAULT_GROUP,
};

// Function to validate user's group membership
const validateUserGroupMembership = (user, defaultGroupId) => {
  // Check if user has group_roles and is a member of the default group
  if (!user.group_roles || user.group_roles.length === 0) {
    return false;
  }

  return user.group_roles.some(
    (role) => role.group.toString() === defaultGroupId.toString()
  );
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
  // Validate default values before proceeding
  if (!validateDefaultValues()) {
    return;
  }

  try {
    const batchSize = BATCH_SIZE;
    let skip = 0;

    // Fetch selected sites data
    const selectedSites = await getSelectedSites(siteSelectionMethod);

    if (isEmpty(selectedSites) || selectedSites.length < 4) {
      logger.error("☹️☹️ No selected sites found. Aborting preference update.");
      return;
    }

    // Use constants.DEFAULT_GROUP directly
    const defaultGroupId = mongoose.Types.ObjectId(constants.DEFAULT_GROUP);

    while (true) {
      // Fetch users with their group_roles
      const users = await UserModel("airqo")
        .find()
        .limit(batchSize)
        .skip(skip)
        .select("_id group_roles")
        .lean();

      if (users.length === 0) {
        break;
      }

      // Filter users who are members of the default group
      const validUsers = users.filter((user) =>
        validateUserGroupMembership(user, defaultGroupId)
      );

      // Get user IDs of valid users
      const validUserIds = validUsers.map((user) => user._id);

      // Fetch existing preferences for valid users
      const preferences = await PreferenceModel("airqo")
        .find({
          user_id: { $in: validUserIds },
          group_id: defaultGroupId,
        })
        .select("_id user_id selected_sites")
        .lean();

      const preferencesMap = new Map();
      preferences.forEach((pref) => {
        preferencesMap.set(pref.user_id.toString(), pref);
      });

      for (const user of validUsers) {
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
          // No preference exists for the user in the default group, create a new one
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
                $set: {
                  selected_sites: selectedSites,
                  group_id: defaultGroupId,
                },
              },
              {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
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

module.exports = { updatePreferences };
