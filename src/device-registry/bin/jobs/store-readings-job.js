//src/device-registry/bin/jobs/store-readings-job.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/store-readings-job`
);
const EventModel = require("@models/Event");
const ReadingModel = require("@models/Reading");
const { logObject, logText } = require("@utils/shared");
const asyncRetry = require("async-retry");
const { stringify, generateFilter } = require("@utils/common");
const cron = require("node-cron");
const moment = require("moment-timezone");
const NodeCache = require("node-cache");

// Constants
const TIMEZONE = moment.tz.guess();
const JOB_NAME = "store-readings-job";
const JOB_SCHEDULE = "30 * * * *"; // At minute 30 of every hour
const FETCH_BATCH_SIZE = 200;
const MAX_FETCH_ITERATIONS = 100; // Increased safety limit for fetching

const JOB_LOOKBACK_WINDOW_MS =
  constants.JOB_LOOKBACK_WINDOW_MS || 12 * 60 * 60 * 1000; // Default to 12 hours

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

// Enhanced timestamp validation
function validateTimestamp(time) {
  if (!time) {
    return { isValid: false, reason: "null_or_undefined" };
  }

  const momentTime = moment(time);
  if (!momentTime.isValid()) {
    return { isValid: false, reason: "invalid_date_format" };
  }

  const now = moment().tz(TIMEZONE);
  const timeDiff = now.diff(momentTime);

  // Check for future timestamps (allow 5 minutes buffer for clock skew)
  if (timeDiff < -5 * 60 * 1000) {
    return {
      isValid: false,
      reason: "future_timestamp",
      timeDiff: timeDiff,
    };
  }

  // Check for extremely old timestamps (older than 30 days)
  if (timeDiff > 30 * 24 * 60 * 60 * 1000) {
    return {
      isValid: false,
      reason: "timestamp_too_old",
      timeDiff: timeDiff,
    };
  }

  return {
    isValid: true,
    validTime: momentTime.toDate(),
    timeDiff: timeDiff,
  };
}

// Focused batch processor for readings only
class ReadingsBatchProcessor {
  constructor(batchSize = 50) {
    this.batchSize = batchSize;
    this.pendingAveragesQueue = new Map();
    this.processingMetrics = {
      startTime: null,
      endTime: null,
      totalDocuments: 0,
      readingsProcessed: 0,
      readingsFailed: 0,
      timestampValidationFailures: 0,
      averageCalculationFailures: 0,
    };
  }

  async processDocument(doc, bulkAverages) {
    try {
      if (!this.processingMetrics.startTime) {
        this.processingMetrics.startTime = new Date();
      }
      this.processingMetrics.totalDocuments++;

      // Validate timestamp
      const validationResult = validateTimestamp(doc.time);
      if (!validationResult.isValid) {
        logger.debug(
          `⚠️ Skipping reading due to invalid timestamp: ${validationResult.reason} - ${doc.time}`
        );
        this.processingMetrics.timestampValidationFailures++;
        return;
      }

      const docTime = validationResult.validTime;

      // Handle averages calculation - don't let failures stop reading storage
      let averages = null;
      if (doc.site_id) {
        try {
          averages = await this.getOrQueueAverages(
            doc.site_id.toString(),
            bulkAverages
          );
        } catch (error) {
          logger.debug(
            `Failed to get averages for site ${doc.site_id}: ${error.message}`
          );
          this.processingMetrics.averageCalculationFailures++;
          // Continue without averages
        }
      }

      // Prepare reading filter
      const base = { time: docTime };
      let filter = null;

      if (doc.site_id) {
        filter = { ...base, site_id: doc.site_id };
      } else if (doc.grid_id && doc.device_id) {
        filter = { ...base, grid_id: doc.grid_id, device_id: doc.device_id };
      } else if (doc.device_id) {
        filter = { ...base, device_id: doc.device_id };
      }

      if (!filter) {
        logger.debug(
          `⚠️ Skipping reading: missing identity (no site_id, grid_id+device_id, or device_id)`
        );
        this.processingMetrics.readingsFailed++;
        return;
      }

      // Prepare update document
      const { _id, ...updateDoc } = { ...doc, time: docTime };
      if (averages) {
        updateDoc.averages = averages;
      }

      // Save reading
      try {
        await ReadingModel("airqo").updateOne(
          filter,
          { $set: updateDoc },
          { upsert: true }
        );
        this.processingMetrics.readingsProcessed++;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          // Silently count duplicates as successful
          this.processingMetrics.readingsProcessed++;
        } else {
          logger.warn(`Failed to save reading: ${error.message}`);
          this.processingMetrics.readingsFailed++;
        }
      }
    } catch (error) {
      this.processingMetrics.readingsFailed++;
      if (!isDuplicateKeyError(error)) {
        logger.error(`🐛 Error processing document: ${error.message}`);
      }
      // Continue processing other documents
    }
  }

  async getOrQueueAverages(siteId, bulkAverages) {
    const cachedAverages = siteAveragesCache.get(siteId);
    if (cachedAverages) {
      return cachedAverages;
    }

    if (this.pendingAveragesQueue.has(siteId)) {
      return this.pendingAveragesQueue.get(siteId);
    }

    // Use pre-fetched bulk averages if available
    if (bulkAverages && bulkAverages[siteId]) {
      return bulkAverages[siteId];
    }

    const averagesPromise = this.calculateAverages(siteId); // Fallback for safety
    this.pendingAveragesQueue.set(siteId, averagesPromise);

    try {
      const averages = await averagesPromise;
      if (averages) {
        siteAveragesCache.set(siteId, averages);
      }
      return averages;
    } finally {
      this.pendingAveragesQueue.delete(siteId);
    }
  }

  async calculateAverages(siteId) {
    try {
      const averages = await EventModel("airqo").getAirQualityAverages(siteId);
      return averages?.success ? averages.data : null;
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        logger.debug(
          `Error calculating averages for site ${siteId}: ${error.message}`
        );
      }
      return null;
    }
  }

  getProcessingReport() {
    this.processingMetrics.endTime = new Date();

    const totalAttempted =
      this.processingMetrics.readingsProcessed +
      this.processingMetrics.readingsFailed;
    const successRate =
      totalAttempted > 0
        ? Math.round(
            (this.processingMetrics.readingsProcessed / totalAttempted) * 10000
          ) / 100
        : 0;

    return {
      summary: {
        totalDocuments: this.processingMetrics.totalDocuments,
        readingsProcessed: this.processingMetrics.readingsProcessed,
        readingsFailed: this.processingMetrics.readingsFailed,
        successRate: successRate,
        processingDuration:
          this.processingMetrics.endTime - this.processingMetrics.startTime,
      },
      details: {
        timestampValidationFailures: this.processingMetrics
          .timestampValidationFailures,
        averageCalculationFailures: this.processingMetrics
          .averageCalculationFailures,
        startTime: this.processingMetrics.startTime,
        endTime: this.processingMetrics.endTime,
      },
    };
  }
}

// New function to fetch all recent events in smaller batches
async function fetchAllRecentEvents(lastProcessedTime) {
  let allEvents = [];
  let skip = 0;
  let hasMore = true;
  let iteration = 0;

  logText("Fetching recent events in batches...");

  // Define the time window for the query
  const endTime = new Date();
  let startTime = lastProcessedTime;

  // If there's no last processed time, default to the job's lookback window
  if (!startTime) {
    startTime = new Date(Date.now() - JOB_LOOKBACK_WINDOW_MS);
    logger.warn(
      `No last processed time found. Defaulting to a ${JOB_LOOKBACK_WINDOW_MS /
        (1000 * 60 * 60)}-hour lookback.`
    );
  }

  while (hasMore && iteration < MAX_FETCH_ITERATIONS) {
    try {
      const request = {
        query: {
          tenant: "airqo",
          recent: "yes",
          metadata: "site_id",
          internal: "yes", // Added to match server-side visibility semantics
          active: "yes",
          brief: "yes",
          limit: FETCH_BATCH_SIZE,
          skip: skip,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      };

      const filter = generateFilter.fetch(request);
      const fetchOptions = { ...filter, isHistorical: false };

      const FETCH_TIMEOUT = 45000; // 45 seconds
      const response = await Promise.race([
        EventModel("airqo").fetch(fetchOptions),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Fetch timeout")), FETCH_TIMEOUT)
        ),
      ]);

      if (
        response?.success &&
        Array.isArray(response.data?.[0]?.data) &&
        response.data[0].data.length > 0
      ) {
        const batchEvents = response.data[0].data;
        allEvents = allEvents.concat(batchEvents);

        logText(
          `Fetched batch ${iteration + 1}: ${
            batchEvents.length
          } events (total: ${allEvents.length})`
        );

        if (batchEvents.length < FETCH_BATCH_SIZE) {
          hasMore = false;
          logText("Reached end of recent events");
        } else {
          skip += FETCH_BATCH_SIZE;
          iteration++;
          await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
        }
      } else {
        hasMore = false;
        if (iteration === 0) {
          logText("No recent events found in the first batch");
        }
      }
    } catch (error) {
      logger.error(
        `Error fetching event batch ${iteration + 1}: ${error.message}`
      );
      hasMore = false; // Stop on error
    }
  }

  if (iteration >= MAX_FETCH_ITERATIONS) {
    logger.warn(`Reached maximum fetch iterations (${MAX_FETCH_ITERATIONS})`);
  }

  logText(`Total events fetched for processing: ${allEvents.length}`);
  return allEvents;
}

// New function to calculate averages for all sites in one go
async function calculateAveragesInBulk(siteIds) {
  if (!siteIds || siteIds.length === 0) {
    return {};
  }
  logText(`Calculating averages for ${siteIds.length} unique sites...`);
  try {
    const averages = await EventModel("airqo").getAirQualityAveragesForSites(
      siteIds
    );
    if (averages.success) {
      return averages.data;
    }
    return {};
  } catch (error) {
    logger.error(`Error calculating bulk averages: ${error.message}`);
    return {};
  }
}

// Main function focused purely on readings
async function fetchAndStoreReadings() {
  const batchProcessor = new ReadingsBatchProcessor(50);

  try {
    logText("Starting optimized readings processing job");

    // 1. Get the timestamp of the last processed reading
    let lastProcessedTime = null;
    try {
      const latestReading = await ReadingModel("airqo")
        .find({})
        .sort({ time: -1 })
        .limit(1)
        .select("time")
        .lean();

      if (latestReading.length > 0) {
        // Add a 10-minute buffer to prevent missing data
        lastProcessedTime = new Date(
          latestReading[0].time.getTime() - 10 * 60 * 1000
        );
        logText(
          `Last processed reading time: ${lastProcessedTime.toISOString()}`
        );
      }
    } catch (error) {
      logger.warn(
        `Could not determine last processed reading time: ${error.message}`
      );
    }

    // 2. Fetch all new events since the last run
    const allEvents = await fetchAllRecentEvents(lastProcessedTime);

    if (allEvents.length === 0) {
      logText("No events found to process into Readings");
      return;
    }

    // 3. Get unique site IDs and calculate averages in bulk
    // Deduplicate site_ids by converting to string first
    const uniqueSiteIds = [
      ...new Set(
        allEvents
          .map((e) => (e.site_id ? e.site_id.toString() : null))
          .filter(Boolean)
      ),
    ];
    const bulkAverages = await calculateAveragesInBulk(uniqueSiteIds);

    // Process in batches
    const batches = [];
    for (let i = 0; i < allEvents.length; i += batchProcessor.batchSize) {
      batches.push(allEvents.slice(i, i + batchProcessor.batchSize));
    }

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map((doc) =>
          asyncRetry(
            async (bail) => {
              try {
                // Pass bulk averages to the processor
                await batchProcessor.processDocument(doc, bulkAverages);
              } catch (error) {
                if (isDuplicateKeyError(error)) {
                  return; // Skip duplicates
                }
                if (error.name === "MongoError" && error.code !== 11000) {
                  throw error; // Retry non-duplicate database errors
                }
                if (!isDuplicateKeyError(error)) {
                  logger.debug(`Error processing document: ${error.message}`);
                  throw error;
                }
              }
            },
            {
              retries: 2,
              minTimeout: 500,
              factor: 2,
            }
          )
        )
      );
    }

    // Generate processing report
    const report = batchProcessor.getProcessingReport();

    // Simple success logging
    if (report.summary.successRate >= 95) {
      logText(
        `✅ Readings processed successfully: ${report.summary.readingsProcessed}/${report.summary.totalDocuments} documents (${report.summary.successRate}% success rate)`
      );
    } else {
      logger.warn(
        `⚠️ Readings processing completed with issues: ${report.summary.readingsProcessed}/${report.summary.totalDocuments} documents (${report.summary.successRate}% success rate)`
      );
      logger.info(`📊 Processing details: ${stringify(report.details)}`);
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logText(
        "Readings processing completed with some duplicate entries (ignored)"
      );
    } else {
      logger.error(`🐛 Error in readings processing: ${stringify(error)}`);
    }
  }
}

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = fetchAndStoreReadings();
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
    scheduled: true,
    timezone: TIMEZONE,
  });

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
          await currentJobPromise;
        }
      } catch (e) {
        logger.error(
          `🐛🐛 Error while awaiting in-flight ${JOB_NAME} during stop: ${e.message}`
        );
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started - focused on readings storage`);
};

startJob();

// Export for testing purposes
module.exports = {
  fetchAndStoreReadings,
  ReadingsBatchProcessor,
  isDuplicateKeyError,
  validateTimestamp,
};
