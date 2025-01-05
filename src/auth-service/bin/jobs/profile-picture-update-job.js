const cron = require("node-cron");
const NetworkModel = require("@models/Network");
const GroupModel = require("@models/Group");
const mongoose = require("mongoose");
const constants = require("@config/constants");
const log4js = require("log4js");
const { logText, logObject } = require("@utils/log");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/profile-picture-update-job`
);
const stringify = require("@utils/stringify");
const isEmpty = require("is-empty");

// Configuration
const BATCH_SIZE = 100;
const DEFAULT_PROFILE_PICTURE = constants.DEFAULT_ORGANISATION_PROFILE_PICTURE;
const MAX_CONCURRENT_OPERATIONS = 5; // Limit concurrent operations

// Function to validate URL
const isValidUrl = (url) => {
  const urlRegex =
    /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
  return urlRegex.test(url);
};

// Function to validate the default profile picture
const validateDefaultProfilePicture = () => {
  if (!isValidUrl(DEFAULT_PROFILE_PICTURE)) {
    logger.error(
      `🚨 Aborting profile picture update: Invalid default profile picture URL`
    );
    return false;
  }
  return true;
};

// Generic function to process items in batches with controlled concurrency
async function processBatch(items, processFunction) {
  const chunks = [];
  for (let i = 0; i < items.length; i += MAX_CONCURRENT_OPERATIONS) {
    chunks.push(items.slice(i, i + MAX_CONCURRENT_OPERATIONS));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(processFunction));
  }
}

// Function to update a single network
async function updateNetworkProfilePicture(network) {
  try {
    await NetworkModel("airqo").findByIdAndUpdate(
      network._id,
      {
        $set: { net_profile_picture: DEFAULT_PROFILE_PICTURE },
      },
      {
        new: true,
        runValidators: true,
      }
    );
    logger.info(`✅ Updated profile picture for network: ${network.net_name}`);
    return { success: true, type: "network", name: network.net_name };
  } catch (error) {
    logger.error(
      `🐛 Failed to update profile picture for network ${
        network.net_name
      }: ${stringify(error)}`
    );
    return { success: false, type: "network", name: network.net_name, error };
  }
}

// Function to update a single group
async function updateGroupProfilePicture(group) {
  try {
    await GroupModel("airqo").findByIdAndUpdate(
      group._id,
      {
        $set: { grp_profile_picture: DEFAULT_PROFILE_PICTURE },
      },
      {
        new: true,
        runValidators: true,
      }
    );
    logger.info(`✅ Updated profile picture for group: ${group.grp_title}`);
    return { success: true, type: "group", name: group.grp_title };
  } catch (error) {
    logger.error(
      `🐛 Failed to update profile picture for group ${
        group.grp_title
      }: ${stringify(error)}`
    );
    return { success: false, type: "group", name: group.grp_title, error };
  }
}

// Main function to update profile pictures
async function updateProfilePictures() {
  // Validate default profile picture before proceeding
  if (!validateDefaultProfilePicture()) {
    return;
  }

  const stats = {
    networks: { processed: 0, success: 0, error: 0 },
    groups: { processed: 0, success: 0, error: 0 },
  };

  try {
    const startTime = Date.now();
    logger.info("🚀 Starting profile picture update process");

    // Process both networks and groups in parallel
    await Promise.all([
      // Update Networks
      (async () => {
        let skip = 0;
        while (true) {
          const networks = await NetworkModel("airqo")
            .find({
              $or: [
                { net_profile_picture: { $exists: false } },
                { net_profile_picture: null },
              ],
            })
            .limit(BATCH_SIZE)
            .skip(skip)
            .select("_id net_name net_profile_picture")
            .lean();

          if (networks.length === 0) break;

          const results = await processBatch(
            networks,
            updateNetworkProfilePicture
          );
          stats.networks.processed += networks.length;
          skip += BATCH_SIZE;
        }
      })(),

      // Update Groups
      (async () => {
        let skip = 0;
        while (true) {
          const groups = await GroupModel("airqo")
            .find({
              $or: [
                { grp_profile_picture: { $exists: false } },
                { grp_profile_picture: null },
              ],
            })
            .limit(BATCH_SIZE)
            .skip(skip)
            .select("_id grp_title grp_profile_picture")
            .lean();

          if (groups.length === 0) break;

          const results = await processBatch(groups, updateGroupProfilePicture);
          stats.groups.processed += groups.length;
          skip += BATCH_SIZE;
        }
      })(),
    ]);

    const duration = (Date.now() - startTime) / 1000;
    logText(`
      📊 Profile picture update completed in ${duration} seconds
      Networks processed: ${stats.networks.processed}
      Groups processed: ${stats.groups.processed}
    `);
    logger.info(`
      📊 Profile picture update completed in ${duration} seconds
      Networks processed: ${stats.networks.processed}
      Groups processed: ${stats.groups.processed}
    `);
  } catch (error) {
    logObject("error", error);
    logger.error(`🐛🐛 Error in updateProfilePictures: ${stringify(error)}`);
  }
}

// // Schedule the job to run daily at midnight
const schedule = "0 0 * * *";
cron.schedule(schedule, updateProfilePictures, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

// Export for manual execution if needed
module.exports = {
  updateProfilePictures,
  updateNetworkProfilePicture,
  updateGroupProfilePicture,
};
