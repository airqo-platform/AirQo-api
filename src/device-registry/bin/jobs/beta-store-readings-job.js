const constants = require("@config/constants");
const EventModel = require("@models/Event");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const ReadingModel = require("@models/Reading");
const { logObject, logText } = require("@utils/shared");
const asyncRetry = require("async-retry");
const { stringify, generateFilter } = require("@utils/common");
const cron = require("node-cron");
const moment = require("moment-timezone");
const NodeCache = require("node-cache");

// Constants
const TIMEZONE = moment.tz.guess();
const INACTIVE_THRESHOLD = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

const JOB_NAME = "store-readings-job";
const JOB_SCHEDULE = "30 * * * *"; // At minute 30 of every hour

// Cache manager for storing site averages
const siteAveragesCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

// Utility function to check if an error is a duplicate key error
function isDuplicateKeyError(error) {
  return (
    error &&
    (error.code === 11000 ||
      (error.name === "MongoError" && error.code === 11000))
  );
}

// Helper function to update entity status
async function updateEntityStatus(Model, filter, time, entityType) {
  try {
    const entity = await Model.findOne(filter);
    if (entity) {
      const isActive = isEntityActive(entity, time);
      const updateData = {
        lastActive: moment(time)
          .tz(TIMEZONE)
          .toDate(),
        isOnline: isActive,
      };
      await Model.updateOne(filter, updateData);
    } else {
      // Alert-worthy issue - entity not found
      global.alertLogger.warn(
        `⚠️ ${entityType} not found with filter: ${stringify(filter)}`
      );

      // Detailed logging for troubleshooting (no Slack spam)
      global.appLogger.warn(`${entityType} lookup failed:`, {
        filter: stringify(filter),
        timestamp: new Date().toISOString(),
        job: JOB_NAME,
      });
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }

    // Critical system error
    global.criticalLogger.error(
      `💥 Error updating ${entityType}'s status: ${error.message}`
    );
    global.criticalLogger.error(`Stack trace: ${error.stack}`);

    // Detailed error logging
    global.appLogger.error(`Entity status update failed:`, {
      entityType,
      filter: stringify(filter),
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      job: JOB_NAME,
    });
  }
}

// Helper function to check if entity is active
function isEntityActive(entity, time) {
  if (!entity || !entity.lastActive) {
    return false;
  }
  const currentTime = moment()
    .tz(TIMEZONE)
    .toDate();
  const measurementTime = moment(time)
    .tz(TIMEZONE)
    .toDate();
  return currentTime - measurementTime < INACTIVE_THRESHOLD;
}

// Batch processing manager
class BatchProcessor {
  constructor(batchSize = 50) {
    this.batchSize = batchSize;
    this.pendingAveragesQueue = new Map(); // site_id -> Promise
    this.processingBatch = false;
  }

  async processDocument(doc) {
    try {
      const docTime = moment(doc.time).tz(TIMEZONE);
      const updatePromises = [];

      // Handle site and device status updates
      if (doc.site_id) {
        updatePromises.push(
          updateEntityStatus(
            SiteModel("airqo"),
            { _id: doc.site_id },
            docTime.toDate(),
            "Site"
          )
        );
      }

      if (doc.device_id) {
        updatePromises.push(
          updateEntityStatus(
            DeviceModel("airqo"),
            { _id: doc.device_id },
            docTime.toDate(),
            "Device"
          )
        );
      }

      // Wait for status updates
      await Promise.all(updatePromises);

      // Handle averages calculation with caching
      let averages = null;
      if (doc.site_id) {
        averages = await this.getOrQueueAverages(doc.site_id.toString());
      }

      // Prepare and save reading
      const filter = { site_id: doc.site_id, time: docTime.toDate() };
      const { _id, ...updateDoc } = { ...doc, time: docTime.toDate() };

      if (averages) {
        updateDoc.averages = averages;
      }
      await ReadingModel("airqo").updateOne(filter, updateDoc, {
        upsert: true,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        // Silently ignore duplicate key errors - no logging
        return; // Skip to the next document
      }

      // Critical processing error
      global.criticalLogger.error(
        `💥 Error processing document: ${error.message}`
      );

      // Detailed error logging
      global.appLogger.error(`Document processing failed:`, {
        document: stringify(doc),
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        job: JOB_NAME,
      });

      throw error;
    }
  }

  async getOrQueueAverages(siteId) {
    // Check cache first
    const cachedAverages = siteAveragesCache.get(siteId);
    if (cachedAverages) {
      return cachedAverages;
    }

    // If there's already a pending request for this site, return that promise
    if (this.pendingAveragesQueue.has(siteId)) {
      return this.pendingAveragesQueue.get(siteId);
    }

    // Create new promise for this site
    const averagesPromise = this.calculateAverages(siteId);
    this.pendingAveragesQueue.set(siteId, averagesPromise);

    try {
      const averages = await averagesPromise;
      // Cache the result
      if (averages) {
        siteAveragesCache.set(siteId, averages);
      }
      return averages;
    } finally {
      // Clean up the queue
      this.pendingAveragesQueue.delete(siteId);
    }
  }

  async calculateAverages(siteId) {
    try {
      const averages = await EventModel("airqo").getAirQualityAverages(siteId);
      return averages?.success ? averages.data : null;
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return null; // Silently ignore duplicate key errors
      }

      // Critical calculation error
      global.criticalLogger.error(
        `💥 Error calculating averages for site ${siteId}: ${error.message}`
      );

      // Detailed error logging
      global.appLogger.error(`Averages calculation failed:`, {
        siteId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        job: JOB_NAME,
      });

      return null;
    }
  }
}

// Helper function to update offline devices
async function updateOfflineDevices(data) {
  try {
    const activeDeviceIds = new Set(data.map((doc) => doc.device_id));
    const thresholdTime = moment()
      .subtract(INACTIVE_THRESHOLD, "milliseconds")
      .toDate();

    const result = await DeviceModel("airqo").updateMany(
      {
        _id: { $nin: Array.from(activeDeviceIds) },
        lastActive: { $lt: thresholdTime },
      },
      { isOnline: false }
    );

    // Log operational statistics (no Slack)
    global.appLogger.info(`Offline devices update completed:`, {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      activeDeviceCount: activeDeviceIds.size,
      timestamp: new Date().toISOString(),
      job: JOB_NAME,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }

    // Critical system error
    global.criticalLogger.error(
      `💥 Error updating offline devices: ${error.message}`
    );

    // Detailed error logging
    global.appLogger.error(`Offline devices update failed:`, {
      error: error.message,
      stack: error.stack,
      activeDeviceCount: data.length,
      timestamp: new Date().toISOString(),
      job: JOB_NAME,
    });
  }
}

// Helper function to update offline sites
async function updateOfflineSites(data) {
  try {
    const activeSiteIds = new Set(
      data.map((doc) => doc.site_id).filter(Boolean)
    );
    const thresholdTime = moment()
      .subtract(INACTIVE_THRESHOLD, "milliseconds")
      .toDate();

    const result = await SiteModel("airqo").updateMany(
      {
        _id: { $nin: Array.from(activeSiteIds) },
        lastActive: { $lt: thresholdTime },
      },
      { isOnline: false }
    );

    // Log operational statistics (no Slack)
    global.appLogger.info(`Offline sites update completed:`, {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      activeSiteCount: activeSiteIds.size,
      timestamp: new Date().toISOString(),
      job: JOB_NAME,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }

    // Critical system error
    global.criticalLogger.error(
      `💥 Error updating offline sites: ${error.message}`
    );

    // Detailed error logging
    global.appLogger.error(`Offline sites update failed:`, {
      error: error.message,
      stack: error.stack,
      activeSiteCount: data.filter((doc) => doc.site_id).length,
      timestamp: new Date().toISOString(),
      job: JOB_NAME,
    });
  }
}

// Main function to fetch and store data
async function fetchAndStoreDataIntoReadingsModel() {
  const batchProcessor = new BatchProcessor(50);
  const startTime = Date.now();

  try {
    const request = {
      query: {
        tenant: "airqo",
        recent: "yes",
        metadata: "site_id",
        active: "yes",
        brief: "yes",
      },
    };
    const filter = generateFilter.fetch(request);

    let viewEventsResponse;
    try {
      viewEventsResponse = await EventModel("airqo").fetch(filter);
      logText("Running the data insertion script");

      // Log job start (no Slack)
      global.appLogger.info(`${JOB_NAME} execution started`, {
        filter: stringify(filter),
        timestamp: new Date().toISOString(),
        job: JOB_NAME,
      });
    } catch (fetchError) {
      if (isDuplicateKeyError(fetchError)) {
        logText("Ignoring duplicate key error in fetch operation");
        return;
      }

      // Critical fetch error (will alert in Slack)
      global.criticalLogger.error(
        `💥 Error fetching events: ${stringify(fetchError)}`
      );

      // Detailed error logging
      global.appLogger.error(`Event fetch failed:`, {
        error: stringify(fetchError),
        filter: stringify(filter),
        timestamp: new Date().toISOString(),
        job: JOB_NAME,
      });

      return;
    }

    if (
      !viewEventsResponse?.success ||
      !Array.isArray(viewEventsResponse.data?.[0]?.data)
    ) {
      // Alert-worthy issue - invalid response
      global.alertLogger.warn(
        "⚠️ Invalid or empty response from EventModel.fetch()"
      );

      // Detailed logging for troubleshooting
      global.appLogger.warn(`Invalid fetch response:`, {
        success: viewEventsResponse?.success,
        dataStructure: typeof viewEventsResponse?.data,
        timestamp: new Date().toISOString(),
        job: JOB_NAME,
      });

      return;
    }

    const data = viewEventsResponse.data[0].data;
    if (data.length === 0) {
      logText("No Events found to insert into Readings");

      // Log operational status (no Slack)
      global.appLogger.info(`${JOB_NAME} completed - no events to process`, {
        timestamp: new Date().toISOString(),
        job: JOB_NAME,
      });

      return;
    }

    // Process in batches
    const batches = [];
    for (let i = 0; i < data.length; i += batchProcessor.batchSize) {
      batches.push(data.slice(i, i + batchProcessor.batchSize));
    }

    let processedCount = 0;
    let errorCount = 0;

    for (const batch of batches) {
      await Promise.all(
        batch.map((doc) =>
          asyncRetry(
            async (bail) => {
              try {
                await batchProcessor.processDocument(doc);
                processedCount++;
              } catch (error) {
                if (isDuplicateKeyError(error)) {
                  // Silently ignore duplicate key errors
                  return;
                }
                if (error.name === "MongoError") {
                  // Critical MongoDB error
                  global.criticalLogger.error(
                    `💥 MongoError -- fetchAndStoreDataIntoReadingsModel -- ${stringify(
                      error
                    )}`
                  );

                  errorCount++;
                  throw error; // Retry non-duplicate errors
                }
                // Log other errors as critical
                global.criticalLogger.error(
                  `💥 Error processing document: ${error.message}`
                );

                errorCount++;
                throw error;
              }
            },
            {
              retries: 3,
              minTimeout: 1000,
              factor: 2,
            }
          )
        )
      );
    }

    // Update offline devices and sites
    await Promise.all([updateOfflineDevices(data), updateOfflineSites(data)]);

    const executionTime = Date.now() - startTime;

    logText("All data inserted successfully and offline devices updated");

    // Log completion statistics (no Slack)
    global.appLogger.info(`${JOB_NAME} completed successfully`, {
      totalEvents: data.length,
      processedCount,
      errorCount,
      batchCount: batches.length,
      executionTimeMs: executionTime,
      cacheStats: {
        keys: siteAveragesCache.keys().length,
        hits: siteAveragesCache.getStats().hits,
        misses: siteAveragesCache.getStats().misses,
      },
      timestamp: new Date().toISOString(),
      job: JOB_NAME,
    });

    // Alert if significant errors occurred
    if (errorCount > data.length * 0.1) {
      // More than 10% errors
      global.alertLogger.warn(
        `🔶 High error rate in ${JOB_NAME}: ${errorCount}/${data.length} failed`
      );
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logText("Completed with some duplicate key errors (ignored)");
      return;
    }

    // Critical system error
    global.criticalLogger.error(`💥 Internal Server Error ${stringify(error)}`);

    // Detailed error logging
    global.appLogger.error(`${JOB_NAME} critical failure:`, {
      error: stringify(error),
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      job: JOB_NAME,
    });
  }
}

// Enhanced startup logging
const jobStartupMessage = `Readings storage job (${JOB_NAME}) is now running on schedule: ${JOB_SCHEDULE}`;
logText(jobStartupMessage);
global.appLogger.info(jobStartupMessage);

// Create and register the job
const startJob = () => {
  // Create the cron job instance
  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    fetchAndStoreDataIntoReadingsModel,
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  // Initialize global registry
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  // Enhanced job registration with better error handling
  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    schedule: JOB_SCHEDULE,
    startedAt: new Date().toISOString(),
    stop: async () => {
      try {
        cronJobInstance.stop();

        // Check if destroy method exists (newer node-cron versions)
        if (typeof cronJobInstance.destroy === "function") {
          cronJobInstance.destroy();
        }

        delete global.cronJobs[JOB_NAME];

        const stopMessage = `✅ ${JOB_NAME} stopped successfully`;
        console.log(stopMessage);
        global.appLogger.info(stopMessage);
      } catch (error) {
        const errorMessage = `❌ Error stopping ${JOB_NAME}: ${error.message}`;
        console.error(errorMessage);
        global.criticalLogger.error(errorMessage);
      }
    },
  };

  const startMessage = `✅ ${JOB_NAME} started successfully (schedule: ${JOB_SCHEDULE}, timezone: ${TIMEZONE})`;
  console.log(startMessage);
  global.appLogger.info(startMessage);
};

// Start the job
try {
  startJob();
} catch (error) {
  const startupError = `💥 Failed to start ${JOB_NAME}: ${error.message}`;
  console.error(startupError);
  global.criticalLogger.error(startupError);
  global.criticalLogger.error(`Startup error stack: ${error.stack}`);
}

// Export for testing purposes
module.exports = {
  fetchAndStoreDataIntoReadingsModel,
  BatchProcessor,
  updateEntityStatus,
  isEntityActive,
  updateOfflineDevices,
  updateOfflineSites,
  isDuplicateKeyError, // Export the utility function for testing
};
