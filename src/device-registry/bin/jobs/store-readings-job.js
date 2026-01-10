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

      // Explicitly ensure the details from the 'events' view are preserved.
      if (doc.siteDetails) {
        updateDoc.siteDetails = doc.siteDetails;
      }
      if (doc.gridDetails) {
        updateDoc.gridDetails = doc.gridDetails;
      }
      if (doc.deviceDetails) {
        updateDoc.deviceDetails = doc.deviceDetails;
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

// Main function focused purely on readings
async function fetchAndStoreReadings() {
  const batchProcessor = new ReadingsBatchProcessor(50);

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

    logText("Starting readings processing job");

    let viewEventsResponse;
    try {
      viewEventsResponse = await EventModel("airqo").fetch(filter);
    } catch (fetchError) {
      if (isDuplicateKeyError(fetchError)) {
        logText("Ignoring duplicate key error in fetch operation");
        return;
      }
      logger.error(`🐛 Error fetching events: ${stringify(fetchError)}`);
      return;
    }

    if (
      !viewEventsResponse?.success ||
      !Array.isArray(viewEventsResponse.data?.[0]?.data)
    ) {
      logger.warn("🙀 Invalid or empty response from EventModel.fetch()");
      return;
    }

    const data = viewEventsResponse.data[0].data;
    if (data.length === 0) {
      logText("No Events found to process into Readings");
      return;
    }

    // Process in batches
    const batches = [];
    for (let i = 0; i < data.length; i += batchProcessor.batchSize) {
      batches.push(data.slice(i, i + batchProcessor.batchSize));
    }

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map((doc) =>
          asyncRetry(
            async (bail) => {
              try {
                await batchProcessor.processDocument(doc);
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

const TIMEZONE = moment.tz.guess();
const JOB_NAME = "store-readings-job";
const JOB_SCHEDULE = "30 * * * *"; // At minute 30 of every hour

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
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
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
