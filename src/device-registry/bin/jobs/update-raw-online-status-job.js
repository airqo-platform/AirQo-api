const constants = require("@config/constants");
const log4js = require("log4js");
const createDeviceUtil = require("@utils/device.util");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/update-raw-online-status-job`
);
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const createFeedUtil = require("@utils/feed.util");
const { logObject, logText } = require("@utils/shared");
const cron = require("node-cron");
const moment = require("moment-timezone");
const { getUptimeAccuracyUpdateObject } = require("@utils/common");

// Constants
const TIMEZONE = moment.tz.guess();
const RAW_INACTIVE_THRESHOLD = 1 * 60 * 60 * 1000; // 1 hour in milliseconds
const BATCH_SIZE = 50; // Reduced for better yielding
const MAX_EXECUTION_TIME = 10 * 60 * 1000; // 10 minutes max execution
const YIELD_INTERVAL = 5; // Yield every 5 operations

const JOB_NAME = "update-raw-online-status-job";
const JOB_SCHEDULE = "35 * * * *"; // At minute 35 of every hour

// Non-blocking job processor class
class NonBlockingJobProcessor {
  constructor(jobName) {
    this.jobName = jobName;
    this.startTime = null;
    this.isRunning = false;
    this.shouldStop = false;
    this.operationCount = 0;
  }

  start() {
    if (global.jobMetrics) {
      global.jobMetrics.startJob(this.jobName);
    }
    this.startTime = Date.now();
    this.isRunning = true;
    this.shouldStop = false;
    this.operationCount = 0;
  }

  end() {
    if (global.jobMetrics) {
      global.jobMetrics.endJob(this.jobName);
    }
    this.isRunning = false;
    this.shouldStop = false;
  }

  shouldStopExecution() {
    if (global.isShuttingDown) {
      logText(`${this.jobName} stopping due to application shutdown`);
      return true;
    }

    if (this.startTime && Date.now() - this.startTime > MAX_EXECUTION_TIME) {
      logger.warn(
        `${this.jobName} stopping due to timeout (${MAX_EXECUTION_TIME}ms)`
      );
      return true;
    }

    return this.shouldStop;
  }

  async yieldControl() {
    return new Promise((resolve) => {
      setImmediate(resolve);
    });
  }

  async processWithYielding(operation) {
    this.operationCount++;

    if (this.operationCount % YIELD_INTERVAL === 0) {
      await this.yieldControl();

      if (this.shouldStopExecution()) {
        throw new Error(`${this.jobName} stopped execution`);
      }
    }

    return await operation();
  }

  async processBatch(items, processingFunction) {
    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      try {
        if (this.shouldStopExecution()) {
          logText(
            `${this.jobName} batch processing stopped at item ${i}/${items.length}`
          );
          break;
        }

        const result = await this.processWithYielding(async () => {
          return await processingFunction(items[i], i);
        });

        results.push(result);
      } catch (error) {
        if (error.message.includes("stopped execution")) {
          break;
        }
        logger.error(
          `${this.jobName} error processing item ${i}: ${error.message}`
        );
        errors.push({ index: i, error: error.message });
      }
    }

    return { results, errors, processed: results.length };
  }

  getStats() {
    return {
      jobName: this.jobName,
      isRunning: this.isRunning,
      operationCount: this.operationCount,
      executionTime: this.startTime ? Date.now() - this.startTime : 0,
      shouldStop: this.shouldStop,
    };
  }
}

const isDeviceRawActive = (lastFeedTime) => {
  if (!lastFeedTime) {
    return false;
  }
  const timeDiff = new Date().getTime() - new Date(lastFeedTime).getTime();
  return timeDiff < RAW_INACTIVE_THRESHOLD;
};

const isValidPM25 = (value) => {
  const num = parseFloat(value);
  // Valid if it's a number between 0 and 1000 (practical upper limit)
  return !isNaN(num) && num >= 0 && num <= 1000;
};

// Helper function to determine if a device is considered mobile
const isDeviceActuallyMobile = (device) => {
  // Helper: a device is mobile only if explicitly marked so
  const type = (device?.deployment_type || "").toString().toLowerCase();
  return device?.mobility === true || type === "mobile";
};

const mockNext = (error) => {
  logger.error(`Error passed to mock 'next' function in job: ${error.message}`);
};

const processDeviceBatch = async (devices, processor) => {
  const CONCURRENCY_LIMIT = 5; // Reduced from 8 to prevent overwhelming ThingSpeak
  const siteUpdates = [];
  let totalUpdates = 0;

  // 1. Get all device numbers from the current batch
  const deviceNumbers = devices.map((d) => d.device_number).filter(Boolean);

  // 2. Fetch all necessary device details in a single query with timeout
  let deviceDetailsMap = new Map();
  if (deviceNumbers.length > 0) {
    try {
      const QUERY_TIMEOUT = 10000; // 10 seconds
      const deviceDetails = await Promise.race([
        DeviceModel("airqo")
          .find({ device_number: { $in: deviceNumbers } })
          .select("device_number readKey")
          .lean(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Device details query timeout")),
            QUERY_TIMEOUT
          )
        ),
      ]);

      deviceDetails.forEach((detail) => {
        deviceDetailsMap.set(detail.device_number, detail);
      });
    } catch (error) {
      logger.error(`Error fetching device details for batch: ${error.message}`);
      return 0;
    }
  }

  // 3. Process devices in smaller, concurrent chunks with yielding
  for (let i = 0; i < devices.length; i += CONCURRENCY_LIMIT) {
    if (processor.shouldStopExecution()) {
      logText(`${JOB_NAME} stopping during batch processing`);
      break;
    }

    const chunk = devices.slice(i, i + CONCURRENCY_LIMIT);

    // Process chunk with yielding support
    const batchResult = await processor.processBatch(
      chunk,
      async (device, index) => {
        const result = await processIndividualDevice(device, deviceDetailsMap);
        if (result && result.siteUpdate) {
          siteUpdates.push(result.siteUpdate);
        }
        return result ? result.deviceUpdate : null;
      }
    );

    totalUpdates += batchResult.results.filter((result) => result !== null)
      .length;

    // Perform bulk write for successful operations with error handling
    const bulkOps = batchResult.results.filter(Boolean);
    if (bulkOps.length > 0) {
      try {
        const BULK_TIMEOUT = 15000; // 15 seconds
        await Promise.race([
          DeviceModel("airqo").bulkWrite(bulkOps, { ordered: false }),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Bulk write timeout")),
              BULK_TIMEOUT
            )
          ),
        ]);
      } catch (error) {
        logger.error(`Bulk write error in batch: ${error.message}`);
        // Continue processing instead of failing completely
      }
    }

    // Yield between chunks
    await processor.yieldControl();
  }

  // After processing all device chunks, perform site updates
  if (siteUpdates.length > 0) {
    try {
      const siteBulkOps = siteUpdates.map(({ siteId, update }) => {
        const t = update["latest_pm2_5.raw"]?.time;
        return {
          updateOne: {
            filter: {
              _id: siteId,
              ...(t
                ? {
                    $or: [
                      { "latest_pm2_5.raw.time": { $lt: t } },
                      { "latest_pm2_5.raw.time": { $exists: false } },
                    ],
                  }
                : {}),
            },
            update: { $set: update },
          },
        };
      });
      await SiteModel("airqo").bulkWrite(siteBulkOps, { ordered: false });
      logText(`Updated ${siteUpdates.length} sites with latest PM2.5 values.`);
    } catch (error) {
      logger.error(`Site bulk update error: ${error.message}`);
    }
  }

  return totalUpdates;
};

// Extracted individual device processing function
const processIndividualDevice = async (device, deviceDetailsMap) => {
  if (!device.device_number) {
    // For devices without device_number, we can still track accuracy
    const isCurrentlyRawOnline = device.rawOnlineStatus;
    const isNowRawOnline = false;

    const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
      isCurrentlyOnline: isCurrentlyRawOnline,
      isNowOnline: isNowRawOnline,
      currentStats: device.onlineStatusAccuracy,
      reason: "no_device_number",
    });

    const updateFields = {
      rawOnlineStatus: isNowRawOnline,
    };

    if (device.status === "not deployed" || isDeviceActuallyMobile(device)) {
      updateFields.isOnline = isNowRawOnline;
    }

    const finalSetUpdate = { ...updateFields, ...setUpdate };
    const updateDoc = { $set: finalSetUpdate };
    if (incUpdate) {
      updateDoc.$inc = incUpdate;
    }

    return {
      deviceUpdate: {
        updateOne: {
          filter: { _id: device._id },
          update: updateDoc,
        },
      },
    };
  }

  // Get the API key from the pre-fetched details
  const detail = deviceDetailsMap.get(device.device_number);
  if (!detail || !detail.readKey) {
    const isCurrentlyRawOnline = device.rawOnlineStatus;
    const isNowRawOnline = false;

    const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
      isCurrentlyOnline: isCurrentlyRawOnline,
      isNowOnline: isNowRawOnline,
      currentStats: device.onlineStatusAccuracy,
      reason: "no_readkey",
    });

    const updateFields = {
      rawOnlineStatus: isNowRawOnline,
    };

    if (device.status === "not deployed" || isDeviceActuallyMobile(device)) {
      updateFields.isOnline = isNowRawOnline;
    }

    const finalSetUpdate = { ...updateFields, ...setUpdate };
    const updateDoc = { $set: finalSetUpdate };
    if (incUpdate) {
      updateDoc.$inc = incUpdate;
    }

    return {
      deviceUpdate: {
        updateOne: {
          filter: { _id: device._id },
          update: updateDoc,
        },
      },
    };
  }

  let apiKey;
  try {
    const decryptResponse = await createDeviceUtil.decryptKey(
      detail.readKey,
      mockNext
    );
    if (!decryptResponse.success) {
      return createFailureUpdate(device, "decryption_failed");
    }
    apiKey = decryptResponse.data;
  } catch (error) {
    logger.error(
      `Error decrypting key for device ${device.name}: ${error.message}`
    );
    return createFailureUpdate(device, "decryption_error");
  }

  // Skip devices that are in the exclusion list
  if (constants.DEVICE_NAMES_TO_EXCLUDE_FROM_JOB.includes(device.name)) {
    return null;
  }
  // Fetch data from ThingSpeak with timeout
  try {
    const request = {
      channel: device.device_number,
      api_key: apiKey,
    };

    // Add timeout to prevent hanging
    const thingspeakData = await Promise.race([
      createFeedUtil.fetchThingspeakData(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("ThingSpeak fetch timeout")), 30000)
      ),
    ]);

    let isRawOnline = false;
    let lastFeedTime = null;
    let latestRawPm25 = null;
    let updateFields = {};

    if (thingspeakData && thingspeakData.feeds && thingspeakData.feeds[0]) {
      const lastFeed = thingspeakData.feeds[0];
      lastFeedTime = lastFeed.created_at;
      isRawOnline = isDeviceRawActive(lastFeedTime);

      // Use the centralized mapping utility to get the pm2_5 value
      const transformedMeasurement = createFeedUtil.transformMeasurement(
        lastFeed
      );
      const pm25Value = transformedMeasurement.pm2_5;

      if (isValidPM25(pm25Value)) {
        latestRawPm25 = {
          value: parseFloat(pm25Value),
          time: new Date(lastFeedTime),
        };
        updateFields["latest_pm2_5.raw"] = latestRawPm25;
      }
    }

    // Update raw status for ALL devices
    updateFields.rawOnlineStatus = isRawOnline;
    if (lastFeedTime) {
      // Continue updating lastRawData for backward compatibility
      updateFields.lastRawData = new Date(lastFeedTime);
    }

    // ALSO update primary online status for UNDEPLOYED or MOBILE devices
    if (device.status === "not deployed" || isDeviceActuallyMobile(device)) {
      updateFields.isOnline = isRawOnline;
      if (lastFeedTime) {
        updateFields.lastActive = new Date(lastFeedTime);
      }
    }

    // Calculate accuracy update for ALL devices
    const isCurrentlyRawOnline = device.rawOnlineStatus;
    const isNowRawOnline = isRawOnline;
    const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
      isCurrentlyOnline: isCurrentlyRawOnline,
      isNowOnline: isNowRawOnline,
      currentStats: device.onlineStatusAccuracy,
      reason: isNowRawOnline ? "online_raw" : "offline_raw",
    });

    const finalSetUpdate = { ...updateFields, ...setUpdate };
    const updateDoc = { $set: finalSetUpdate };
    if (incUpdate) {
      updateDoc.$inc = incUpdate;
    }

    // Prepare site update if PM2.5 is valid and device is primary for its site
    let siteUpdate = null;
    if (latestRawPm25 && device.isPrimaryInLocation && device.site_id) {
      siteUpdate = {
        siteId: device.site_id,
        update: { "latest_pm2_5.raw": latestRawPm25 },
      };
    }

    return {
      deviceUpdate: {
        updateOne: {
          filter: {
            _id: device._id,
            ...(latestRawPm25
              ? {
                  $or: [
                    { "latest_pm2_5.raw.time": { $lt: latestRawPm25.time } },
                    { "latest_pm2_5.raw.time": { $exists: false } },
                  ],
                }
              : {}),
          },
          update: updateDoc,
        },
      },
      siteUpdate,
    };
  } catch (error) {
    logger.error(
      `Error processing raw status for device ${device.name}: ${error.message}`
    );
    return createFailureUpdate(device, "fetch_error");
  }
};

// Helper function to create failure updates
const createFailureUpdate = (device, reason) => {
  const isCurrentlyRawOnline = device.rawOnlineStatus;
  const isNowRawOnline = false;

  const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
    isCurrentlyOnline: isCurrentlyRawOnline,
    isNowOnline: isNowRawOnline,
    currentStats: device.onlineStatusAccuracy,
    reason: reason,
  });

  const updateFields = {
    rawOnlineStatus: isNowRawOnline,
  };

  if (device.status === "not deployed" || isDeviceActuallyMobile(device)) {
    updateFields.isOnline = isNowRawOnline;
  }

  const finalSetUpdate = { ...updateFields, ...setUpdate };
  const updateDoc = { $set: finalSetUpdate };
  if (incUpdate) {
    updateDoc.$inc = incUpdate;
  }

  return {
    deviceUpdate: {
      updateOne: {
        filter: { _id: device._id },
        update: updateDoc,
      },
    },
  };
};

const updateRawOnlineStatus = async () => {
  const processor = new NonBlockingJobProcessor(JOB_NAME);

  try {
    processor.start();
    const startTime = Date.now();
    logText(`Starting raw online status check for ALL devices...`);
    let totalDevices = 0;

    try {
      const COUNT_TIMEOUT = 5000; // 5 seconds
      totalDevices = await Promise.race([
        DeviceModel("airqo").estimatedDocumentCount(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Device count timed out")),
            COUNT_TIMEOUT
          )
        ),
      ]);
    } catch (error) {
      logger.warn(`Could not retrieve total device count: ${error.message}`);
      logText("Could not retrieve total device count, proceeding without it.");
    }

    const countLog = totalDevices > 0 ? `~${totalDevices}` : "all";
    logText(`Found ${countLog} devices to process in batches of ${BATCH_SIZE}`);

    // Use cursor with smaller memory footprint
    const cursor = DeviceModel("airqo")
      .find({})
      .select(
        "_id name device_number status isOnline rawOnlineStatus onlineStatusAccuracy mobility deployment_type grid_id site_id isPrimaryInLocation"
      )
      .lean()
      .batchSize(BATCH_SIZE) // Add batch size for cursor
      .cursor();

    let batch = [];
    let totalProcessed = 0;
    let errorCount = 0;
    const MAX_ERRORS = 50; // Stop if too many errors

    try {
      for await (const device of cursor) {
        if (processor.shouldStopExecution()) {
          logText(`${JOB_NAME} stopping during processing`);
          break;
        }

        batch.push(device);

        if (batch.length >= BATCH_SIZE) {
          try {
            const updatedCount = await processDeviceBatch(batch, processor);
            totalProcessed += batch.length;

            logText(
              `Batch processed: ${updatedCount}/${batch.length} updates. Total: ${totalProcessed}/${totalDevices}`
            );

            // Reset error count on successful batch
            errorCount = 0;
          } catch (batchError) {
            errorCount++;
            logger.error(
              `Batch processing error (${errorCount}/${MAX_ERRORS}): ${batchError.message}`
            );

            // Stop if too many consecutive errors
            if (errorCount >= MAX_ERRORS) {
              logger.error(`Too many batch errors, stopping job`);
              break;
            }
          }

          batch = [];

          // Yield between batches to prevent blocking
          await processor.yieldControl();

          // Add small delay to prevent overwhelming external APIs
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } finally {
      await cursor.close();
    }

    // Process the final batch if it's not empty
    if (batch.length > 0 && !processor.shouldStopExecution()) {
      try {
        const updatedCount = await processDeviceBatch(batch, processor);
        totalProcessed += batch.length;
        logText(
          `Final batch processed: ${updatedCount}/${batch.length} updates. Total: ${totalProcessed}`
        );
      } catch (finalBatchError) {
        logger.error(
          `Final batch processing error: ${finalBatchError.message}`
        );
      }
    }

    const duration = (Date.now() - startTime) / 1000;
    logText(
      `Raw online status check complete in ${duration}s. Processed ${totalProcessed} devices.`
    );
  } catch (error) {
    if (error.message.includes("stopped execution")) {
      logText(`${JOB_NAME} stopped gracefully during execution`);
    } else {
      logger.error(`Error in raw online status job: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
    }
  } finally {
    processor.end();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }
};

const startJob = () => {
  // Idempotency check: prevent re-registering the job
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    return;
  }

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
          delete global.cronJobs[JOB_NAME];
          logText(`🧹 ${JOB_NAME} removed from job registry.`);
        }
      },
    };
  } catch (error) {
    logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  }
};

// Defer the job start to the next tick of the event loop
// This prevents it from blocking the main application startup
process.nextTick(startJob);

module.exports = {
  updateRawOnlineStatus,
  NonBlockingJobProcessor,
};
