const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/v2.1-store-readings-job`
);
const EventModel = require("@models/Event");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const ReadingModel = require("@models/Reading");
const { logText, logObject, logElement } = require("@utils/log");
const stringify = require("@utils/stringify");
const asyncRetry = require("async-retry");
const generateFilter = require("@utils/generate-filter");
const cron = require("node-cron");
const moment = require("moment-timezone");
const NodeCache = require("node-cache");

// Constants
const TIMEZONE = moment.tz.guess();
const INACTIVE_THRESHOLD = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

// Cache manager for storing site averages
const siteAveragesCache = new NodeCache({ stdTTL: 3600 }); // 1 hour TTL

// Helper function to update entity status (previously undefined)
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
      logger.error(`🐛🐛 Error processing document: ${error.message}`);
      throw error;
    }
  }

  async getOrQueueAverages(siteId) {
    // Check cache first
    // logObject("the siteId", siteId);
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
      logger.error(
        `🐛🐛 Error calculating averages for site ${siteId}: ${error.message}`
      );
      return null;
    }
  }
}

// Helper function to update offline devices
async function updateOfflineDevices(data) {
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
                if (error.name === "MongoError" && error.code !== 11000) {
                  logger.error(
                    `🐛🐛 MongoError -- fetchAndStoreDataIntoReadingsModel -- ${stringify(
                      error
                    )}`
                  );
                  throw error; // Retry non-duplicate errors
                }
                // Log duplicate errors but don't retry
                console.warn(
                  `🙀🙀 Duplicate key error for document: ${stringify(doc)}`
                );
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

    // Update offline devices
    await updateOfflineDevices(data);

    logText("All data inserted successfully and offline devices updated");
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${stringify(error)}`);
  }
}

// Schedules job to run once every hour at minute 30
const schedule = "30 * * * *";
cron.schedule(schedule, fetchAndStoreDataIntoReadingsModel, {
  scheduled: true,
  timezone: TIMEZONE,
});

// Export for testing purposes
module.exports = {
  fetchAndStoreDataIntoReadingsModel,
  BatchProcessor,
  updateEntityStatus,
  isEntityActive,
  updateOfflineDevices,
};
