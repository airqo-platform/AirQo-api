const cron = require("node-cron");
const GroupModel = require("@models/Group");
const mongoose = require("mongoose");
const constants = require("@config/constants");
const log4js = require("log4js");
const { logObject, logText } = require("@utils/shared");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/profile-picture-update-job`
);
const { stringify } = require("@utils/common");
const { acquireCronLock } = require("@utils/common/cron-lock.util");
const isEmpty = require("is-empty");

// Configuration
const BATCH_SIZE = 100;
const DEFAULT_PROFILE_PICTURE = constants.DEFAULT_ORGANISATION_PROFILE_PICTURE;
const MAX_CONCURRENT_OPERATIONS = 5; // Limit concurrent operations
const jobName = "profile-picture-update-job";

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

  const gotLock = await acquireCronLock("airqo", jobName);
  if (!gotLock) return;

  const stats = {
    groups: { processed: 0, success: 0, error: 0 },
  };

  try {
    const startTime = Date.now();
    logger.info("🚀 Starting profile picture update process");

    // Update Groups. Cursor-paginate by _id rather than skip: since each
    // processed group drops out of the filter (its grp_profile_picture gets
    // set), a skip-based offset would silently miss groups as the matching
    // set shrinks out from under it.
    let lastId = null;
    while (true) {
      const filter = {
        $or: [
          { grp_profile_picture: { $exists: false } },
          { grp_profile_picture: null },
        ],
      };
      if (lastId) {
        filter._id = { $gt: lastId };
      }

      const groups = await GroupModel("airqo")
        .find(filter)
        .sort({ _id: 1 })
        .limit(BATCH_SIZE)
        .select("_id grp_title grp_profile_picture")
        .lean();

      if (groups.length === 0) break;

      const results = await processBatch(groups, updateGroupProfilePicture);
      stats.groups.processed += groups.length;
      lastId = groups[groups.length - 1]._id;
    }

    const duration = (Date.now() - startTime) / 1000;
    logText(`
      📊 Profile picture update completed in ${duration} seconds
      Groups processed: ${stats.groups.processed}
    `);
    logger.info(`
      📊 Profile picture update completed in ${duration} seconds
      Groups processed: ${stats.groups.processed}
    `);
  } catch (error) {
    logObject("error", error);
    logger.error(`🐛🐛 Error in updateProfilePictures: ${stringify(error)}`);
  }
}

global.cronJobs = global.cronJobs || {};
// // Schedule the job to run daily at midnight
const schedule = "0 0 * * *";
global.cronJobs[jobName] = cron.schedule(schedule, updateProfilePictures, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

// Export for manual execution if needed
module.exports = {
  updateProfilePictures,
  updateGroupProfilePicture,
};
