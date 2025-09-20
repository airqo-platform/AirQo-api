const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/update-raw-online-status-job`
);
const DeviceModel = require("@models/Device");
const createFeedUtil = require("@utils/feed.util");
const { logObject, logText } = require("@utils/shared");
const cron = require("node-cron");
const moment = require("moment-timezone");

// Constants
const TIMEZONE = moment.tz.guess();
const RAW_INACTIVE_THRESHOLD = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
const BATCH_SIZE = 100;

const JOB_NAME = "update-raw-online-status-job";
const JOB_SCHEDULE = "0 * * * *"; // Every hour

const isDeviceRawActive = (lastFeedTime) => {
  if (!lastFeedTime) {
    return false;
  }
  const timeDiff = new Date().getTime() - new Date(lastFeedTime).getTime();
  return timeDiff < RAW_INACTIVE_THRESHOLD;
};

const mockNext = (error) => {
  logger.error(`Error passed to mock 'next' function in job: ${error.message}`);
};

const processDeviceBatch = async (devices) => {
  const devicePromises = devices.map(async (device) => {
    if (!device.device_number) {
      logger.warn(
        `Skipping device ${device.name || device._id} - missing device_number`
      );
      return null;
    }

    try {
      const apiKeyResponse = await createFeedUtil.getAPIKey(
        device.device_number,
        mockNext
      );

      if (!apiKeyResponse.success) {
        logger.warn(
          `Could not get API key for device ${device.name}: ${apiKeyResponse.message}`
        );
        return null;
      }

      const request = {
        channel: device.device_number,
        api_key: apiKeyResponse.data,
      };
      const thingspeakData = await createFeedUtil.fetchThingspeakData(request);

      let isRawOnline = false;
      let lastFeedTime = null;
      let updateFields = {};

      if (thingspeakData && thingspeakData.feeds && thingspeakData.feeds[0]) {
        const lastFeed = thingspeakData.feeds[0];
        lastFeedTime = lastFeed.created_at;
        isRawOnline = isDeviceRawActive(lastFeedTime);
      }

      // Update raw status for ALL devices
      updateFields.rawOnlineStatus = isRawOnline;
      if (lastFeedTime) {
        updateFields.lastRawData = new Date(lastFeedTime);
      }

      // ALSO update primary online status for UNDEPLOYED devices
      if (device.status === "not deployed") {
        updateFields.isOnline = isRawOnline;
        if (lastFeedTime) {
          updateFields.lastActive = new Date(lastFeedTime);
        }
      }

      return {
        updateOne: {
          filter: { _id: device._id },
          update: {
            $set: updateFields,
          },
        },
      };
    } catch (error) {
      logger.error(
        `Error processing raw status for device ${device.name}: ${error.message}`
      );
      return null;
    }
  });

  const bulkOps = (await Promise.all(devicePromises)).filter(Boolean);

  if (bulkOps.length > 0) {
    await DeviceModel("airqo").bulkWrite(bulkOps);
  }

  return bulkOps.length;
};

const updateRawOnlineStatus = async () => {
  try {
    const startTime = Date.now();
    logText(`Starting raw online status check for ALL devices...`);

    const cursor = DeviceModel("airqo")
      .find({})
      .select("_id name device_number status")
      .lean()
      .cursor();

    let batch = [];
    let totalProcessed = 0;

    for await (const device of cursor) {
      if (global.isShuttingDown) {
        logText(
          `${JOB_NAME} stopping during processing due to application shutdown.`
        );
        await cursor.close();
        return;
      }

      batch.push(device);
      if (batch.length >= BATCH_SIZE) {
        const updatedCount = await processDeviceBatch(batch);
        totalProcessed += batch.length;
        logText(
          `Processed batch. ${updatedCount} updates. Total processed: ${totalProcessed}`
        );
        batch = []; // Clear the batch
      }
    }

    // Process the final batch if it's not empty
    if (batch.length > 0) {
      const updatedCount = await processDeviceBatch(batch);
      totalProcessed += batch.length;
      logText(
        `Processed final batch. ${updatedCount} updates. Total processed: ${totalProcessed}`
      );
    }

    const duration = (Date.now() - startTime) / 1000;
    logger.info(
      `Raw online status check complete in ${duration}s. Processed ${totalProcessed} devices.`
    );
  } catch (error) {
    logger.error(`Error in raw online status job: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

const startJob = () => {
  try {
    let isJobRunning = false;
    let currentJobPromise = null;

    const cronJobInstance = cron.schedule(
      JOB_SCHEDULE,
      async () => {
        if (isJobRunning) {
          logger.warn(
            `${JOB_NAME} is already running, skipping this execution.`
          );
          return;
        }
        isJobRunning = true;
        currentJobPromise = updateRawOnlineStatus();
        await currentJobPromise;
        isJobRunning = false;
        currentJobPromise = null;
      },
      {
        scheduled: true,
        timezone: TIMEZONE,
      }
    );

    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    global.cronJobs[JOB_NAME] = {
      job: cronJobInstance,
      stop: async () => {
        logText(`🛑 Stopping ${JOB_NAME}...`);
        try {
          // Stop the cron schedule to prevent new runs
          cronJobInstance.stop();
          logText(`📅 ${JOB_NAME} schedule stopped.`);

          // If a job is currently running, wait for it to complete
          if (currentJobPromise) {
            logText(
              `⏳ Waiting for current ${JOB_NAME} execution to finish...`
            );
            await currentJobPromise;
            logText(`✅ Current ${JOB_NAME} execution completed.`);
          }

          // Destroy the job instance to clean up resources
          if (typeof cronJobInstance.destroy === "function") {
            cronJobInstance.destroy();
          }
          logText(`💥 ${JOB_NAME} destroyed successfully.`);

          // Remove from global registry
          delete global.cronJobs[JOB_NAME];
        } catch (error) {
          logger.error(`❌ Error stopping ${JOB_NAME}: ${error.message}`);
        }
      },
    };

    console.log(`✅ ${JOB_NAME} started`);
  } catch (error) {
    logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  }
};

// Defer the job start to the next tick of the event loop
// This prevents it from blocking the main application startup
process.nextTick(startJob);

module.exports = {
  updateRawOnlineStatus,
};
