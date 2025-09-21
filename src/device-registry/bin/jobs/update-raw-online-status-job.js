const constants = require("@config/constants");
const log4js = require("log4js");
const createDeviceUtil = require("@utils/device.util");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/update-raw-online-status-job`
);
const DeviceModel = require("@models/Device");
const createFeedUtil = require("@utils/feed.util");
const { logObject, logText } = require("@utils/shared");
const cron = require("node-cron");
const moment = require("moment-timezone");
const { getUptimeAccuracyUpdateObject } = require("@utils/common");

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
  const CONCURRENCY_LIMIT = 10; // Process 10 devices at a time to prevent saturation
  let totalUpdates = 0;

  // 1. Get all device numbers from the current batch
  const deviceNumbers = devices.map((d) => d.device_number).filter(Boolean);

  // 2. Fetch all necessary device details (readKey) in a single query
  let deviceDetailsMap = new Map();
  if (deviceNumbers.length > 0) {
    try {
      const deviceDetails = await DeviceModel("airqo")
        .find({ device_number: { $in: deviceNumbers } })
        .select("device_number readKey")
        .lean();

      deviceDetails.forEach((detail) => {
        deviceDetailsMap.set(detail.device_number, detail);
      });
    } catch (error) {
      logger.error(`Error fetching device details for batch: ${error.message}`);
      return 0; // Skip this batch if we can't get device details
    }
  }

  // 3. Process devices in smaller, concurrent chunks
  for (let i = 0; i < devices.length; i += CONCURRENCY_LIMIT) {
    if (global.isShuttingDown) {
      logText(
        `${JOB_NAME} stopping during batch processing due to application shutdown.`
      );
      break;
    }

    const chunk = devices.slice(i, i + CONCURRENCY_LIMIT);

    const devicePromises = chunk.map(async (device) => {
      if (!device.device_number) {
        // logger.warn(
        //   `Skipping device ${device.name || device._id} - missing device_number`
        // );
        return null;
      }

      // 4. Get the API key from the pre-fetched details
      const detail = deviceDetailsMap.get(device.device_number);
      if (!detail || !detail.readKey) {
        // logger.warn(`No readKey found for device ${device.name}`);
        return null;
      }

      let apiKey;
      try {
        const decryptResponse = await createDeviceUtil.decryptKey(
          detail.readKey,
          mockNext
        );
        if (!decryptResponse.success) {
          // logger.warn(
          //   `Failed to decrypt key for device ${device.name}: ${decryptResponse.message}`
          // );
          return null;
        }
        apiKey = decryptResponse.data;
      } catch (error) {
        logger.error(
          `Error decrypting key for device ${device.name}: ${error.message}`
        );
        return null;
      }

      // 5. Fetch data from ThingSpeak
      try {
        const request = {
          channel: device.device_number,
          api_key: apiKey,
        };
        const thingspeakData = await createFeedUtil.fetchThingspeakData(
          request
        );

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

        // Calculate accuracy update ONLY for UNDEPLOYED devices to avoid double-counting
        let setUpdate = {};
        let incUpdate = null;
        if (device.status === "not deployed") {
          const isCurrentlyOnline = device.isOnline;
          const isNowOnline = isRawOnline;
          ({ setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
            isCurrentlyOnline,
            isNowOnline,
            currentStats: device.onlineStatusAccuracy,
            reason: isNowOnline ? "online_raw" : "offline_raw",
          }));
        }
        const finalSetUpdate = { ...updateFields, ...setUpdate };
        const updateDoc = { $set: finalSetUpdate };
        if (incUpdate) {
          updateDoc.$inc = incUpdate;
        }

        return {
          updateOne: {
            filter: { _id: device._id },
            update: updateDoc,
          },
        };
      } catch (error) {
        // This specifically catches errors from fetchThingspeakData (e.g., timeouts)
        logger.error(
          `Error processing raw status for device ${device.name}: ${error.message}`
        );
        return null;
      }
    });

    const chunkBulkOps = (await Promise.all(devicePromises)).filter(Boolean);

    // 6. Perform a bulk write for each small chunk
    if (chunkBulkOps.length > 0) {
      await DeviceModel("airqo").bulkWrite(chunkBulkOps);
      totalUpdates += chunkBulkOps.length;
    }

    // Yield to the event loop after each small chunk to prevent blocking
    await new Promise((resolve) => setImmediate(resolve));
  }

  return totalUpdates;
};

const updateRawOnlineStatus = async () => {
  try {
    const startTime = Date.now();
    logText(`Starting raw online status check for ALL devices...`);

    const totalDevices = await DeviceModel("airqo").countDocuments({});
    if (totalDevices === 0) {
      logText("No devices to process.");
      return;
    }

    const cursor = DeviceModel("airqo")
      .find({})
      .select("_id name device_number status isOnline onlineStatusAccuracy") // Fetch accuracy fields
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
          `Processed batch. ${updatedCount} updates. Total processed: ${totalProcessed}/${totalDevices}`
        );
        batch = []; // Clear the batch
        // Yield to the event loop to prevent blocking other operations
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    // Process the final batch if it's not empty
    if (batch.length > 0) {
      const updatedCount = await processDeviceBatch(batch);
      totalProcessed += batch.length;
      logText(
        `Processed final batch. ${updatedCount} updates. Total processed: ${totalProcessed}/${totalDevices}`
      );
    }

    const duration = (Date.now() - startTime) / 1000;
    // logger.info(
    //   `Raw online status check complete in ${duration}s. Processed ${totalProcessed} devices.`
    // );
  } catch (error) {
    logger.error(`Error in raw online status job: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

const startJob = () => {
  // Idempotency check: prevent re-registering the job
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    // logger.warn(`${JOB_NAME} already registered. Skipping duplicate start.`);
    return;
  }

  try {
    let isJobRunning = false;
    let currentJobPromise = null;

    const cronJobInstance = cron.schedule(
      JOB_SCHEDULE,
      async () => {
        if (isJobRunning) {
          // logger.warn(
          //   `${JOB_NAME} is already running, skipping this execution.`
          // );
          return;
        }
        isJobRunning = true;
        currentJobPromise = updateRawOnlineStatus();
        try {
          await currentJobPromise;
        } catch (err) {
          logger.error(
            `🐛🐛 Error executing ${JOB_NAME}: ${err.stack || err.message}`
          );
        } finally {
          isJobRunning = false;
          currentJobPromise = null;
        }
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
        cronJobInstance.stop();
        logText(`📅 ${JOB_NAME} schedule stopped.`);
        try {
          if (currentJobPromise) {
            logText(
              `⏳ Waiting for current ${JOB_NAME} execution to finish...`
            );
            await currentJobPromise;
            logText(`✅ Current ${JOB_NAME} execution completed.`);
          }
        } catch (error) {
          logger.error(
            `🐛🐛 Error while awaiting in-flight ${JOB_NAME} during stop: ${error.message}`
          );
        } finally {
          if (typeof cronJobInstance.destroy === "function") {
            cronJobInstance.destroy();
            logText(`💥 ${JOB_NAME} destroyed successfully.`);
          }
          delete global.cronJobs[JOB_NAME];
          logText(`🧹 ${JOB_NAME} removed from job registry.`);
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
