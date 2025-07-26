const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/v2.1-store-readings-job`
);
const EventModel = require("@models/Event");
const GridModel = require("@models/Grid");
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
      logger.warn(
        `🙀🙀 ${entityType} not found with filter: ${stringify(filter)}`
      );
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(
      `🐛🐛 Error updating ${entityType}'s status: ${error.message}`
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
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

      if (doc.grid_id) {
        updatePromises.push(
          updateEntityStatus(
            GridModel("airqo"),
            { _id: doc.grid_id },
            docTime.toDate(),
            "Grid"
          )
        );
      }

      if (doc.grid_id && doc.device_id) {
        updatePromises.push(
          updateGridMobileDeviceActivity(
            doc.grid_id,
            doc.device_id,
            docTime.toDate()
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
      // Build appropriate filter based on deployment type
      let filter = { time: docTime.toDate() };

      if (doc.deployment_type === "static") {
        filter.site_id = doc.site_id;
      } else if (doc.deployment_type === "mobile") {
        if (doc.grid_id) {
          filter.grid_id = doc.grid_id;
        }
        filter.device_id = doc.device_id;
      }
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
      logger.error(`🐛🐛 Error processing document: ${error.message}`);
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
      logger.error(
        `🐛🐛 Error calculating averages for site ${siteId}: ${error.message}`
      );
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

    await DeviceModel("airqo").updateMany(
      {
        _id: { $nin: Array.from(activeDeviceIds) },
        lastActive: { $lt: thresholdTime },
      },
      { isOnline: false }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(`🐛🐛 Error updating offline devices: ${error.message}`);
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

    await SiteModel("airqo").updateMany(
      {
        _id: { $nin: Array.from(activeSiteIds) },
        lastActive: { $lt: thresholdTime },
      },
      { isOnline: false }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(`🐛🐛 Error updating offline sites: ${error.message}`);
  }
}

// Helper function to update offline grids for mobile devices
async function updateOfflineGrids(data) {
  try {
    const activeGridIds = new Set(
      data
        .filter((doc) => doc.deployment_type === "mobile" && doc.grid_id)
        .map((doc) => doc.grid_id)
        .filter(Boolean)
    );

    const thresholdTime = moment()
      .subtract(INACTIVE_THRESHOLD, "milliseconds")
      .toDate();

    await GridModel("airqo").updateMany(
      {
        _id: { $nin: Array.from(activeGridIds) },
        lastActive: { $lt: thresholdTime },
      },
      { isOnline: false }
    );
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(`🐛🐛 Error updating offline grids: ${error.message}`);
  }
}

// Helper function to update offline grids for mobile devices
async function updateGridMobileDeviceActivity(gridId, deviceId, time) {
  try {
    await GridModel("airqo").updateMobileDeviceActivity(gridId, deviceId);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return; // Silently ignore duplicate key errors
    }
    logger.error(
      `🐛🐛 Error updating grid mobile device activity: ${error.message}`
    );
  }
}

// Main function to fetch and store data
async function fetchAndStoreDataIntoReadingsModel() {
  const batchProcessor = new BatchProcessor(50);

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
    } catch (fetchError) {
      if (isDuplicateKeyError(fetchError)) {
        logText("Ignoring duplicate key error in fetch operation");
        return;
      }
      logger.error(`🐛🐛 Error fetching events: ${stringify(fetchError)}`);
      return;
    }

    if (
      !viewEventsResponse?.success ||
      !Array.isArray(viewEventsResponse.data?.[0]?.data)
    ) {
      logger.warn("🙀🙀 Invalid or empty response from EventModel.fetch()");
      return;
    }

    const data = viewEventsResponse.data[0].data;
    if (data.length === 0) {
      logText("No Events found to insert into Readings");
      return;
    }

    // Process in batches
    const batches = [];
    for (let i = 0; i < data.length; i += batchProcessor.batchSize) {
      batches.push(data.slice(i, i + batchProcessor.batchSize));
    }

    for (const batch of batches) {
      await Promise.all(
        batch.map((doc) =>
          asyncRetry(
            async (bail) => {
              try {
                await batchProcessor.processDocument(doc);
              } catch (error) {
                if (isDuplicateKeyError(error)) {
                  // Silently ignore duplicate key errors
                  return;
                }
                if (error.name === "MongoError") {
                  logger.error(
                    `🐛🐛 MongoError -- fetchAndStoreDataIntoReadingsModel -- ${stringify(
                      error
                    )}`
                  );
                  throw error; // Retry non-duplicate errors
                }
                // Log other errors
                logger.error(
                  `🐛🐛 Error processing document: ${error.message}`
                );
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
    await Promise.all([
      updateOfflineDevices(data),
      updateOfflineSites(data),
      updateOfflineGrids(data),
    ]);

    try {
      await GridModel("airqo").cleanupInactiveDevices(5); // 5-hour threshold
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        logger.error(
          `🐛🐛 Error cleaning up inactive grid devices: ${error.message}`
        );
      }
    }

    logText("All data inserted successfully and offline devices updated");
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logText("Completed with some duplicate key errors (ignored)");
      return;
    }
    logger.error(`🐛🐛 Internal Server Error ${stringify(error)}`);
  }
}

// Create and register the job
const startJob = () => {
  // Create the cron job instance 👇 THIS IS THE cronJobInstance!
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

  // Register for cleanup 👇 USING cronJobInstance HERE!
  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      cronJobInstance.stop();
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

startJob();

// Export for testing purposes
module.exports = {
  fetchAndStoreDataIntoReadingsModel,
  BatchProcessor,
  updateEntityStatus,
  updateGridMobileDeviceActivity,
  updateOfflineGrids,
  isEntityActive,
  updateOfflineDevices,
  updateOfflineSites,
  isDuplicateKeyError,
};
