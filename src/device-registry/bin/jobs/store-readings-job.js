//src/device-registry/bin/jobs/store-readings-job.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/store-readings-job`
);
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

// Update accuracy tracking in database
async function updateEntityonlineStatusAccuracy(
  Model,
  entityId,
  isSuccess,
  reason,
  entityType
) {
  try {
    const incUpdate = {
      "onlineStatusAccuracy.totalAttempts": 1,
      ...(isSuccess
        ? { "onlineStatusAccuracy.successfulUpdates": 1 }
        : { "onlineStatusAccuracy.failedUpdates": 1 }),
    };
    const setUpdate = {
      "onlineStatusAccuracy.lastUpdate": new Date(),
      ...(isSuccess
        ? { "onlineStatusAccuracy.lastSuccessfulUpdate": new Date() }
        : { "onlineStatusAccuracy.lastFailureReason": reason }),
    };
    await Model.findByIdAndUpdate(
      entityId,
      { $inc: incUpdate, $set: setUpdate },
      { upsert: false }
    );
  } catch (error) {
    // Don't let accuracy tracking errors stop the main process
    logger.warn(
      `Failed to update accuracy tracking for ${entityType} ${entityId}: ${error.message}`
    );
  }
}

// Enhanced entity status update with better validation and atomic operations
async function updateEntityStatus(Model, filter, time, entityType) {
  let entityId = null;
  try {
    // Validate timestamp first
    const validationResult = validateTimestamp(time);
    if (!validationResult.isValid) {
      logger.warn(
        `🙀🙀 Invalid timestamp for ${entityType}: ${validationResult.reason} - ${time}`
      );
      // Still try to get entity ID for accuracy tracking
      try {
        const entity = await Model.findOne(filter, { _id: 1 });
        if (entity) {
          entityId = entity._id;
          await updateEntityonlineStatusAccuracy(
            Model,
            entityId,
            false,
            validationResult.reason,
            entityType
          );
        }
      } catch (err) {
        // Ignore errors in accuracy tracking
      }
      return { success: false, reason: validationResult.reason };
    }

    const isActive = isEntityActive(validationResult.validTime);
    const lastActiveTime = moment(validationResult.validTime)
      .tz(TIMEZONE)
      .toDate();

    // Use atomic findOneAndUpdate with better error handling
    const result = await Model.findOneAndUpdate(
      filter,
      {
        $set: {
          lastActive: lastActiveTime,
          isOnline: isActive,
          statusUpdatedAt: new Date(),
          statusSource: "cron_job",
        },
      },
      {
        new: true,
        upsert: false,
        runValidators: true,
      }
    );

    if (result) {
      entityId = result._id;
      await updateEntityonlineStatusAccuracy(
        Model,
        entityId,
        true,
        "success",
        entityType
      );
      return {
        success: true,
        wasOnline: isActive,
        entityId: result._id,
        lastActive: lastActiveTime,
      };
    } else {
      logger.warn(
        `🙀🙀 ${entityType} not found with filter: ${stringify(filter)}`
      );
      return { success: false, reason: "entity_not_found" };
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      if (entityId) {
        await updateEntityonlineStatusAccuracy(
          Model,
          entityId,
          false,
          "duplicate_key",
          entityType
        );
      }
      return { success: true, reason: "duplicate_ignored" };
    }
    logger.error(
      `🐛🐛 Error updating ${entityType}'s status: ${error.message}`
    );
    if (entityId) {
      await updateEntityonlineStatusAccuracy(
        Model,
        entityId,
        false,
        "database_error",
        entityType
      );
    }
    return { success: false, reason: "database_error", error: error.message };
  }
}

// Enhanced activity check with better edge case handling
function isEntityActive(time) {
  if (!time) {
    return false;
  }

  const validationResult = validateTimestamp(time);
  if (!validationResult.isValid) {
    return false;
  }

  return validationResult.timeDiff < INACTIVE_THRESHOLD;
}

// Enhanced offline detection with accuracy tracking
async function updateOfflineEntitiesWithAccuracy(
  Model,
  activeEntityIds,
  entityType,
  statusResults
) {
  try {
    const thresholdTime = moment()
      .subtract(INACTIVE_THRESHOLD, "milliseconds")
      .toDate();

    // More sophisticated offline detection
    const offlineUpdateResult = await Model.updateMany(
      {
        _id: { $nin: Array.from(activeEntityIds) },
        lastActive: { $lt: thresholdTime },
        $or: [{ isOnline: true }, { isOnline: { $exists: false } }],
      },
      {
        $set: {
          isOnline: false,
          statusUpdatedAt: new Date(),
          statusSource: "cron_offline_detection",
        },
        $inc: {
          "onlineStatusAccuracy.totalAttempts": 1,
          "onlineStatusAccuracy.successfulUpdates": 1,
        },
      }
    );

    let modified = 0;
    if (offlineUpdateResult) {
      if (offlineUpdateResult.modifiedCount !== undefined) {
        modified = offlineUpdateResult.modifiedCount;
      } else if (offlineUpdateResult.nModified !== undefined) {
        modified = offlineUpdateResult.nModified;
      }
    }

    // Track accuracy metrics
    const accuracyMetrics = {
      entityType,
      totalProcessed: activeEntityIds.size,
      markedOffline: modified,
      successfulUpdates: statusResults.filter((r) => r.success).length,
      failedUpdates: statusResults.filter((r) => !r.success).length,
      timestamp: new Date(),
    };

    logger.info(
      `📊 ${entityType} Status Update Metrics: ${stringify(accuracyMetrics)}`
    );

    return {
      success: true,
      metrics: accuracyMetrics,
      offlineCount: modified,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logger.info(
        `Duplicate key error in offline detection for ${entityType}s - continuing`
      );
      return { success: true, reason: "duplicate_ignored" };
    }
    logger.error(
      `🐛🐛 Error updating offline ${entityType}s: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

// Legacy functions for backward compatibility
async function updateOfflineDevices(data) {
  const activeDeviceIds = new Set(
    data.map((doc) => doc.device_id).filter(Boolean)
  );
  const deviceResults = data.map(() => ({ success: true }));
  const result = await updateOfflineEntitiesWithAccuracy(
    DeviceModel("airqo"),
    activeDeviceIds,
    "Device",
    deviceResults
  );
  if (!result.success) {
    logger.error(`Failed to update offline devices: ${result.error}`);
  }
}

async function updateOfflineSites(data) {
  const activeSiteIds = new Set(data.map((doc) => doc.site_id).filter(Boolean));
  const siteResults = data.map(() => ({ success: true }));
  const result = await updateOfflineEntitiesWithAccuracy(
    SiteModel("airqo"),
    activeSiteIds,
    "Site",
    siteResults
  );
  if (!result.success) {
    logger.error(`Failed to update offline sites: ${result.error}`);
  }
}

// Enhanced batch processing manager
class BatchProcessor {
  constructor(batchSize = 50) {
    this.batchSize = batchSize;
    this.pendingAveragesQueue = new Map();
    this.processingBatch = false;
    this.statusResults = {
      devices: [],
      sites: [],
    };
    this.processingMetrics = {
      startTime: null,
      endTime: null,
      totalDocuments: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      readingsProcessed: 0,
      readingsFailed: 0,
    };
  }

  async processDocument(doc) {
    try {
      const docTime = moment(doc.time).tz(TIMEZONE);
      const updatePromises = [];

      if (!this.processingMetrics.startTime) {
        this.processingMetrics.startTime = new Date();
      }
      this.processingMetrics.totalDocuments++;

      // Handle site status updates with result tracking
      if (doc.site_id) {
        const siteUpdatePromise = updateEntityStatus(
          SiteModel("airqo"),
          { _id: doc.site_id },
          docTime.toDate(),
          "Site"
        )
          .then((result) => {
            this.statusResults.sites.push({
              siteId: doc.site_id,
              result: result,
              timestamp: new Date(),
            });
            return result;
          })
          .catch((error) => {
            logger.error(
              `Site status update failed for ${doc.site_id}: ${error.message}`
            );
            this.statusResults.sites.push({
              siteId: doc.site_id,
              result: {
                success: false,
                reason: "exception",
                error: error.message,
              },
              timestamp: new Date(),
            });
            return { success: false, reason: "exception" };
          });
        updatePromises.push(siteUpdatePromise);
      }

      // Handle device status updates with result tracking
      if (doc.device_id) {
        const deviceUpdatePromise = updateEntityStatus(
          DeviceModel("airqo"),
          { _id: doc.device_id },
          docTime.toDate(),
          "Device"
        )
          .then((result) => {
            this.statusResults.devices.push({
              deviceId: doc.device_id,
              result: result,
              timestamp: new Date(),
            });
            return result;
          })
          .catch((error) => {
            logger.error(
              `Device status update failed for ${doc.device_id}: ${error.message}`
            );
            this.statusResults.devices.push({
              deviceId: doc.device_id,
              result: {
                success: false,
                reason: "exception",
                error: error.message,
              },
              timestamp: new Date(),
            });
            return { success: false, reason: "exception" };
          });
        updatePromises.push(deviceUpdatePromise);
      }

      // Wait for status updates - don't let failures stop the process
      try {
        const results = await Promise.allSettled(updatePromises);
        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value.success) {
            this.processingMetrics.successfulUpdates++;
          } else {
            this.processingMetrics.failedUpdates++;
          }
        });
      } catch (error) {
        logger.error(`Error in status updates: ${error.message}`);
        this.processingMetrics.failedUpdates++;
      }

      // Handle averages calculation with caching - don't let this stop processing
      let averages = null;
      if (doc.site_id) {
        try {
          averages = await this.getOrQueueAverages(doc.site_id.toString());
        } catch (error) {
          logger.error(
            `Failed to get averages for site ${doc.site_id}: ${error.message}`
          );
        }
      }

      // Prepare and save reading
      const base = { time: docTime.toDate() };
      let filter = null;

      if (doc.site_id) {
        filter = { ...base, site_id: doc.site_id };
      } else if (doc.grid_id && doc.device_id) {
        filter = { ...base, grid_id: doc.grid_id, device_id: doc.device_id };
      } else if (doc.device_id) {
        filter = { ...base, device_id: doc.device_id };
      }

      if (!filter) {
        logger.warn(
          `Skipping reading: missing identity (no site_id, grid_id+device_id, or device_id) – would collapse on time only`
        );
        this.processingMetrics.readingsFailed++;
        return;
      }

      const { _id, ...updateDoc } = { ...doc, time: docTime.toDate() };

      if (averages) {
        updateDoc.averages = averages;
      }

      try {
        await ReadingModel("airqo").updateOne(
          filter,
          { $set: updateDoc },
          { upsert: true }
        );
        this.processingMetrics.readingsProcessed++;
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          // Silently ignore duplicate readings
          this.processingMetrics.readingsProcessed++;
        } else {
          logger.error(`Failed to save reading: ${error.message}`);
          this.processingMetrics.readingsFailed++;
        }
      }
    } catch (error) {
      this.processingMetrics.failedUpdates++;
      this.processingMetrics.readingsFailed++;
      if (!isDuplicateKeyError(error)) {
        logger.error(`🐛🐛 Error processing document: ${error.message}`);
      }
      // Don't throw - continue processing other documents
    }
  }

  async getOrQueueAverages(siteId) {
    const cachedAverages = siteAveragesCache.get(siteId);
    if (cachedAverages) {
      return cachedAverages;
    }

    if (this.pendingAveragesQueue.has(siteId)) {
      return this.pendingAveragesQueue.get(siteId);
    }

    const averagesPromise = this.calculateAverages(siteId);
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
        logger.error(
          `🐛🐛 Error calculating averages for site ${siteId}: ${error.message}`
        );
      }
      return null;
    }
  }

  getAccuracyReport() {
    this.processingMetrics.endTime = new Date();

    const deviceSuccessRate =
      this.statusResults.devices.length > 0
        ? (this.statusResults.devices.filter((d) => d.result.success).length /
            this.statusResults.devices.length) *
          100
        : 0;

    const siteSuccessRate =
      this.statusResults.sites.length > 0
        ? (this.statusResults.sites.filter((s) => s.result.success).length /
            this.statusResults.sites.length) *
          100
        : 0;

    const readingsSuccessRate =
      this.processingMetrics.readingsProcessed +
        this.processingMetrics.readingsFailed >
      0
        ? (this.processingMetrics.readingsProcessed /
            (this.processingMetrics.readingsProcessed +
              this.processingMetrics.readingsFailed)) *
          100
        : 0;

    return {
      processing: this.processingMetrics,
      deviceonlineStatusAccuracy: {
        totalUpdates: this.statusResults.devices.length,
        successRate: Math.round(deviceSuccessRate * 100) / 100,
        failureReasons: this.getFailureReasons(this.statusResults.devices),
      },
      siteonlineStatusAccuracy: {
        totalUpdates: this.statusResults.sites.length,
        successRate: Math.round(siteSuccessRate * 100) / 100,
        failureReasons: this.getFailureReasons(this.statusResults.sites),
      },
      readingsAccuracy: {
        processed: this.processingMetrics.readingsProcessed,
        failed: this.processingMetrics.readingsFailed,
        successRate: Math.round(readingsSuccessRate * 100) / 100,
      },
      overallAccuracy: {
        processingDuration:
          this.processingMetrics.endTime - this.processingMetrics.startTime,
      },
    };
  }

  getFailureReasons(statusResults) {
    const failureReasons = {};
    statusResults
      .filter((item) => !item.result.success)
      .forEach((item) => {
        const reason = item.result.reason || "unknown";
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });
    return failureReasons;
  }
}

// Main function - enhanced with comprehensive error handling but no premature returns
async function fetchAndStoreDataIntoReadingsModel() {
  const batchProcessor = new BatchProcessor(50);
  let hasProcessedData = false;

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
      logText(
        "Running the enhanced data insertion script with accuracy tracking"
      );
    } catch (fetchError) {
      if (isDuplicateKeyError(fetchError)) {
        logText("Ignoring duplicate key error in fetch operation");
        return; // Nothing to process, safe to exit
      }
      logger.error(`🐛🐛 Error fetching events: ${stringify(fetchError)}`);
      return; // Cannot proceed without data, safe to exit
    }

    if (
      !viewEventsResponse?.success ||
      !Array.isArray(viewEventsResponse.data?.[0]?.data)
    ) {
      logger.warn("🙀🙀 Invalid or empty response from EventModel.fetch()");
      return; // No valid data to process, safe to exit
    }

    const data = viewEventsResponse.data[0].data;
    if (data.length === 0) {
      logText("No Events found to insert into Readings");
      return; // No data to process, safe to exit
    }

    hasProcessedData = true;

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
                  logger.error(
                    `🐛🐛 MongoError -- fetchAndStoreDataIntoReadingsModel -- ${stringify(
                      error
                    )}`
                  );
                  throw error; // Retry non-duplicate errors
                }
                if (!isDuplicateKeyError(error)) {
                  logger.error(
                    `🐛🐛 Error processing document: ${error.message}`
                  );
                  throw error;
                }
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

    // Enhanced offline detection with tracking
    const deviceIds = new Set(data.map((doc) => doc.device_id).filter(Boolean));
    const siteIds = new Set(data.map((doc) => doc.site_id).filter(Boolean));

    try {
      const [deviceOfflineResult, siteOfflineResult] = await Promise.allSettled(
        [
          updateOfflineEntitiesWithAccuracy(
            DeviceModel("airqo"),
            deviceIds,
            "Device",
            batchProcessor.statusResults.devices.map((d) => d.result)
          ),
          updateOfflineEntitiesWithAccuracy(
            SiteModel("airqo"),
            siteIds,
            "Site",
            batchProcessor.statusResults.sites.map((s) => s.result)
          ),
        ]
      );

      // Generate and log accuracy report
      const accuracyReport = batchProcessor.getAccuracyReport();
      accuracyReport.offlineDetection = {
        devices:
          deviceOfflineResult.status === "fulfilled"
            ? deviceOfflineResult.value
            : { success: false, error: deviceOfflineResult.reason },
        sites:
          siteOfflineResult.status === "fulfilled"
            ? siteOfflineResult.value
            : { success: false, error: siteOfflineResult.reason },
      };

      logger.info(`📊📊 ACCURACY REPORT: ${stringify(accuracyReport)}`);
    } catch (offlineError) {
      logger.error(`Error in offline detection: ${offlineError.message}`);
      // Log the accuracy report even if offline detection failed
      const accuracyReport = batchProcessor.getAccuracyReport();
      logger.info(`📊📊 PARTIAL ACCURACY REPORT: ${stringify(accuracyReport)}`);
    }

    logText("Data processing completed with enhanced accuracy tracking");
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logText("Completed with some duplicate key errors (ignored)");
    } else {
      logger.error(
        `🐛🐛 Internal Server Error in main processing: ${stringify(error)}`
      );
    }

    // Always try to log accuracy report even if there was an error
    if (hasProcessedData) {
      try {
        const partialReport = batchProcessor.getAccuracyReport();
        logger.info(
          `📊📊 ERROR RECOVERY ACCURACY REPORT: ${stringify(partialReport)}`
        );
      } catch (reportError) {
        logger.error(
          `Failed to generate accuracy report: ${reportError.message}`
        );
      }
    }
  }
}

// Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    fetchAndStoreDataIntoReadingsModel,
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
      cronJobInstance.stop();
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(
    `✅ ${JOB_NAME} started with enhanced accuracy tracking and error recovery`
  );
};

startJob();

// Export for testing purposes
module.exports = {
  fetchAndStoreDataIntoReadingsModel,
  BatchProcessor,
  updateEntityStatus,
  isEntityActive,
  updateOfflineDevices,
  updateOfflineSites,
  isDuplicateKeyError,
  validateTimestamp,
  updateOfflineEntitiesWithAccuracy,
};
