const cron = require("node-cron");
const UserModel = require("@models/User");
const mongoose = require("mongoose");
const PreferenceModel = require("@models/Preference");
const SelectedSiteModel = require("@models/SelectedSite");
const constants = require("@config/constants");
const log4js = require("log4js");
const { logObject } = require("@utils/shared");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/preference-update-job`
);
const { stringify } = require("@utils/common");

const isEmpty = require("is-empty");
const BATCH_SIZE = 100;
const NUMBER_OF_SITES_PER_USER = 2; // Number of sites to select for each user
const SELECTION_POOL_SIZE = 20; // Size of the pool to select from

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

// Function to get a pool of selected sites
const getSelectedSitesPool = async (method = "featured") => {
  try {
    let selectedSites;
    if (method === "featured") {
      selectedSites = await SelectedSiteModel("airqo")
        .find({ isFeatured: true })
        .sort({ createdAt: -1 })
        .limit(SELECTION_POOL_SIZE) // Get more sites to create a pool for random selection
        .lean();
    } else {
      selectedSites = await SelectedSiteModel("airqo")
        .find()
        .sort({ createdAt: -1 })
        .limit(SELECTION_POOL_SIZE) // Get more sites to create a pool for random selection
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

// Function to randomly select n sites from a pool
const getRandomSites = (
  sitesPool,
  numberOfSites = NUMBER_OF_SITES_PER_USER
) => {
  if (sitesPool.length <= numberOfSites) {
    return sitesPool;
  }

  const shuffled = [...sitesPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, numberOfSites);
};

// Helper function to check if an error is a duplicate key error (E11000)
const isDuplicateKeyError = (error) => {
  return error && error.name === "MongoError" && error.code === 11000;
};

const updatePreferences = async (siteSelectionMethod = "featured") => {
  // Validate default values before proceeding
  if (!validateDefaultValues()) {
    return;
  }

  try {
    const batchSize = BATCH_SIZE;
    let skip = 0;

    // Fetch pool of selected sites
    const sitesPool = await getSelectedSitesPool(siteSelectionMethod);

    if (isEmpty(sitesPool) || sitesPool.length < NUMBER_OF_SITES_PER_USER) {
      logger.error(
        `☹️☹️ Not enough selected sites found (need at least ${NUMBER_OF_SITES_PER_USER}). Aborting preference update.`
      );
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

        // Randomly select sites for this user
        const randomSelectedSites = getRandomSites(sitesPool);

        // Prepare the default preference object with the specific group_id
        const defaultPreferenceWithGroupId = {
          ...defaultPreference,
          user_id: user._id,
          group_id: defaultGroupId,
          selected_sites: randomSelectedSites,
        };

        if (!preference) {
          // No preference exists for the user in the default group, create a new one
          try {
            await PreferenceModel("airqo").create(defaultPreferenceWithGroupId);
          } catch (error) {
            // Only log the error if it's not a duplicate key error
            if (!isDuplicateKeyError(error)) {
              logger.error(
                `🐛🐛 Failed to create preference for user ${userIdStr}: ${stringify(
                  error
                )}`
              );
            }
          }
        } else if (isEmpty(preference.selected_sites)) {
          // Preference exists but selected_sites is empty, update it
          try {
            await PreferenceModel("airqo").findOneAndUpdate(
              {
                user_id: user._id,
                group_id: defaultGroupId,
              },
              {
                $set: {
                  selected_sites: randomSelectedSites,
                  group_id: defaultGroupId,
                },
              },
              {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true,
              }
            );
          } catch (error) {
            // Only log the error if it's not a duplicate key error
            if (!isDuplicateKeyError(error)) {
              logger.error(
                `🐛🐛 Failed to update preference for user ${userIdStr}: ${stringify(
                  error
                )}`
              );
            }
          }
        }
      }

      skip += batchSize;
    }

    // logger.info(
    //   `✅ Successfully completed preference update for users with ${NUMBER_OF_SITES_PER_USER} randomly selected sites each`
    // );
  } catch (error) {
    // Only log the error if it's not a duplicate key error
    if (!isDuplicateKeyError(error)) {
      logObject("error", error);
      logger.error(`🐛🐛 Error in updatePreferences: ${stringify(error)}`);
    }
  }
};

global.cronJobs = global.cronJobs || {};
const schedule = "30 * * * *"; // At minute 30 of every hour
const jobName = "preferences-update-job";
global.cronJobs[jobName] = cron.schedule(
  schedule,
  () => updatePreferences("featured"),
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);

module.exports = { updatePreferences };
