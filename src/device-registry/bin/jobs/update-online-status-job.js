const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/update-online-status-job`
);
const EventModel = require("@models/Event");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const LogThrottleModel = require("@models/LogThrottle");
const { logObject, logText } = require("@utils/shared");
const asyncRetry = require("async-retry");
const {
  stringify,
  generateFilter,
  getUptimeAccuracyUpdateObject,
} = require("@utils/common");
const cron = require("node-cron");
const moment = require("moment-timezone");

// Constants
const TIMEZONE = moment.tz.guess();
const INACTIVE_THRESHOLD = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
const STALE_ACCURACY_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours for stale accuracy tracking
const MAX_EXECUTION_TIME = 15 * 60 * 1000; // 15 minutes max execution
const YIELD_INTERVAL = 10; // Yield every 10 operations
const STALE_BATCH_SIZE = 30; // Smaller batches for stale entity processing

const JOB_NAME = "update-online-status-job";
const JOB_SCHEDULE = "45 * * * *"; // At minute 45 of every hour (15 minutes after readings job)

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

// Log throttling configuration
const LOG_THROTTLE_CONFIG = {
  maxLogsPerDay: 1,
  logTypesThrottled: ["METRICS", "ACCURACY_REPORT"],
};

// Database-based Log throttling manager
class LogThrottleManager {
  constructor() {
    this.environment = constants.ENVIRONMENT;
    this.model = LogThrottleModel("airqo");
  }

  async shouldAllowLog(logType) {
    const today = moment()
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");

    try {
      // Use the model's static method to atomically increment the counter
      const result = await this.model.incrementCount({
        date: today,
        logType: logType,
        environment: this.environment,
      });

      if (result.success) {
        // Check if we've exceeded the limit
        const currentCount = result.data?.count || 1;
        return currentCount <= LOG_THROTTLE_CONFIG.maxLogsPerDay;
      } else {
        // On error, default to allowing the log (fail open)
        logger.debug(`Log throttle increment failed: ${result.message}`);
        return true;
      }
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key error - retry once to get current count
        try {
          const countResult = await this.model.getCurrentCount({
            date: today,
            logType: logType,
            environment: this.environment,
          });

          if (countResult.success && countResult.data.exists) {
            // Try to increment again
            const retryResult = await this.model.incrementCount({
              date: today,
              logType: logType,
              environment: this.environment,
            });

            if (retryResult.success) {
              const currentCount = retryResult.data?.count || 1;
              return currentCount <= LOG_THROTTLE_CONFIG.maxLogsPerDay;
            }
          }
        } catch (retryError) {
          logger.warn(`Log throttle retry failed: ${retryError.message}`);
        }
      } else {
        logger.warn(`Log throttle check failed: ${error.message}`);
      }

      // On error, default to allowing the log (fail open)
      return true;
    }
  }

  async getRemainingLogsForToday(logType) {
    const today = moment()
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");

    try {
      const result = await this.model.getCurrentCount({
        date: today,
        logType: logType,
        environment: this.environment,
      });

      if (result.success) {
        const used = result.data?.count || 0;
        return Math.max(0, LOG_THROTTLE_CONFIG.maxLogsPerDay - used);
      } else {
        logger.debug(`Failed to get remaining log count: ${result.message}`);
        return LOG_THROTTLE_CONFIG.maxLogsPerDay; // Default to allowing logs on error
      }
    } catch (error) {
      logger.debug(`Failed to get remaining log count: ${error.message}`);
      return LOG_THROTTLE_CONFIG.maxLogsPerDay; // Default to allowing logs on error
    }
  }

  async cleanupOldEntries() {
    try {
      const result = await this.model.cleanupOldEntries({
        daysToKeep: 7,
        environment: this.environment,
      });

      if (result.success && result.data.deletedCount > 0) {
        logger.debug(
          `Cleaned up ${result.data.deletedCount} old log throttle entries`
        );
      }
    } catch (error) {
      logger.debug(
        `Failed to cleanup old log throttle entries: ${error.message}`
      );
    }
  }

  async getCurrentStats() {
    const today = moment()
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");

    try {
      const result = await this.model.getDailyCounts({
        date: today,
        environment: this.environment,
      });

      if (result.success) {
        const stats = {};
        Object.keys(result.data).forEach((logType) => {
          const data = result.data[logType];
          stats[logType] = {
            count: data.count,
            remaining: Math.max(
              0,
              LOG_THROTTLE_CONFIG.maxLogsPerDay - data.count
            ),
            lastUpdated: data.lastUpdated,
          };
        });
        return stats;
      } else {
        logger.debug(
          `Failed to get current log throttle stats: ${result.message}`
        );
        return {};
      }
    } catch (error) {
      logger.debug(
        `Failed to get current log throttle stats: ${error.message}`
      );
      return {};
    }
  }

  async resetDailyCounts() {
    const today = moment()
      .tz(TIMEZONE)
      .format("YYYY-MM-DD");

    try {
      const result = await this.model.resetDailyCounts({
        date: today,
        environment: this.environment,
      });

      return result;
    } catch (error) {
      logger.warn(`Failed to reset daily counts: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

// Initialize log throttle manager
const logThrottleManager = new LogThrottleManager();

// Enhanced throttled logging function with async support
async function throttledLog(logType, message, forceLog = false) {
  if (forceLog) {
    logger.info(message);
    return;
  }

  try {
    // New time-based check to only log around noon EAT
    const now = moment().tz("Africa/Nairobi");
    const currentHour = now.hour();

    // Only log between 12:00 and 12:59 EAT
    if (currentHour !== 12) {
      logger.debug(
        `Skipping log for ${logType} outside of the 12:00-12:59 EAT window.`
      );
      return;
    }
    const shouldAllow = await logThrottleManager.shouldAllowLog(logType);

    if (shouldAllow) {
      logger.info(message);
    } else {
      // Log throttling is working. A debug log is sufficient to avoid noise.
      logger.debug(
        `Log throttled for ${logType}: Daily limit of ${LOG_THROTTLE_CONFIG.maxLogsPerDay} reached for the 12 PM window.`
      );
    }
  } catch (error) {
    // On error, log the message anyway (fail open)
    logger.info(message);
    logger.debug(`Throttle check failed, logging anyway: ${error.message}`);
  }
}

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

  if (timeDiff < -5 * 60 * 1000) {
    return {
      isValid: false,
      reason: "future_timestamp",
      timeDiff: timeDiff,
    };
  }

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

// Enhanced accuracy tracking with percentage calculations
async function updateEntityOnlineStatusAccuracy(
  Model,
  entityId,
  isCurrentlyOnline, // The status that was in the DB
  isNowOnline, // The status just calculated by the job
  reason,
  entityType
) {
  try {
    const entity = await Model.findById(entityId, {
      onlineStatusAccuracy: 1,
    }).lean();

    const currentStats = entity?.onlineStatusAccuracy || {};

    const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
      isCurrentlyOnline,
      isNowOnline,
      currentStats,
      reason,
    });

    await Model.findByIdAndUpdate(
      entityId,
      { $inc: incUpdate, $set: setUpdate },
      { upsert: false }
    );

    const isTruthful = isCurrentlyOnline === isNowOnline;

    const totalChecks = (currentStats.totalChecks || 0) + 1;
    const correctChecks =
      (currentStats.correctChecks || 0) + (isTruthful ? 1 : 0);
    const incorrectChecks = totalChecks - correctChecks;
    const accuracyPercentage =
      totalChecks > 0 ? (correctChecks / totalChecks) * 100 : 0;

    return {
      success: true,
      stats: {
        totalChecks,
        correctChecks,
        incorrectChecks,
        accuracyPercentage,
      },
    };
  } catch (error) {
    logger.debug(
      `Failed to update accuracy tracking for ${entityType} ${entityId}: ${error.message}`
    );
    return { success: false, error: error.message };
  }
}

// Enhanced entity status update with better validation and atomic operations
async function updateEntityStatus(Model, filter, time, entityType) {
  let entityId = null;
  let isCurrentlyOnline = null;
  try {
    const validationResult = validateTimestamp(time);
    if (!validationResult.isValid) {
      logger.debug(
        `Invalid timestamp for ${entityType}: ${validationResult.reason} - ${time}`
      );
      // We can't determine truthfulness without a valid time, so we just track a failure if possible.
      try {
        const entity = await Model.findOne(filter, { _id: 1, isOnline: 1 });
        if (entity) {
          entityId = entity._id;
          await updateEntityOnlineStatusAccuracy(
            Model,
            entityId,
            entity.isOnline, // current status
            false, // new status is effectively offline
            `invalid_timestamp: ${validationResult.reason}`,
            entityType
          );
        }
      } catch (err) {
        // Ignore errors in accuracy tracking
      }
      return { success: false, reason: validationResult.reason };
    }

    const isNowOnline = isEntityActive(validationResult.validTime);
    const lastActiveTime = moment(validationResult.validTime)
      .tz(TIMEZONE)
      .toDate();

    // Fetch the current state before updating for accuracy calculation
    const currentEntity = await Model.findOne(filter, {
      _id: 1,
      isOnline: 1,
    }).lean();

    if (!currentEntity) {
      logger.debug(`${entityType} not found with filter: ${stringify(filter)}`);
      return { success: false, reason: "entity_not_found" };
    }

    entityId = currentEntity._id;
    isCurrentlyOnline = currentEntity.isOnline;

    const result = await Model.findOneAndUpdate(
      filter,
      {
        $set: {
          lastActive: lastActiveTime,
          isOnline: isNowOnline,
          statusUpdatedAt: new Date(),
          statusSource: "online_status_cron_job",
        },
      },
      {
        new: true,
        upsert: false,
        runValidators: true,
      }
    );

    if (result) {
      const accuracyResult = await updateEntityOnlineStatusAccuracy(
        Model,
        entityId,
        isCurrentlyOnline,
        isNowOnline,
        isCurrentlyOnline === isNowOnline
          ? "status_confirmed"
          : "status_corrected",
        entityType
      );
      return {
        success: true,
        wasOnline: isNowOnline,
        entityId: result._id,
        lastActive: lastActiveTime,
        accuracyStats: accuracyResult.success ? accuracyResult.stats : null,
      };
    } else {
      // This case should be rare now since we check for existence first
      logger.debug(
        `${entityType} not found during update: ${stringify(filter)}`
      );
      return { success: false, reason: "entity_not_found_on_update" };
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      if (entityId) {
        await updateEntityOnlineStatusAccuracy(
          Model,
          entityId,
          isCurrentlyOnline,
          isCurrentlyOnline, // Assume no change on duplicate key error
          "duplicate_key_ignored",
          entityType
        );
      }
      return { success: true, reason: "duplicate_ignored" };
    }
    logger.warn(`Error updating ${entityType}'s status: ${error.message}`);
    if (entityId) {
      await updateEntityOnlineStatusAccuracy(
        Model,
        entityId,
        isCurrentlyOnline,
        isCurrentlyOnline, // Assume no change on error
        "database_error",
        entityType
      );
    }
    return { success: false, reason: "database_error", error: error.message };
  }
}

// Enhanced activity check
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

// New function to process stale entities (devices/sites that haven't been checked recently)
async function processStaleEntities(Model, entityType, processor) {
  try {
    const staleThreshold = new Date(Date.now() - STALE_ACCURACY_THRESHOLD);

    // Find entities that either:
    // 1. Have never had accuracy tracking (lastCheck doesn't exist)
    // 2. Haven't been checked in the last 24 hours
    const staleEntities = await Model.find(
      {
        $or: [
          { "onlineStatusAccuracy.lastCheck": { $exists: false } },
          { "onlineStatusAccuracy.lastCheck": { $lt: staleThreshold } },
        ],
      },
      {
        _id: 1,
        isOnline: 1,
        lastActive: 1,
        onlineStatusAccuracy: 1,
        name: 1,
      }
    )
      .limit(STALE_BATCH_SIZE)
      .lean();

    if (staleEntities.length === 0) {
      return {
        success: true,
        processedCount: 0,
        totalFound: 0,
      };
    }

    // Process stale entities with non-blocking patterns
    const batchResult = await processor.processBatch(
      staleEntities,
      async (entity) => {
        const isCurrentlyOnline = entity.isOnline;
        const shouldBeOnline = isEntityActive(entity.lastActive);

        // Update accuracy tracking for this entity
        await updateEntityOnlineStatusAccuracy(
          Model,
          entity._id,
          isCurrentlyOnline,
          shouldBeOnline,
          "stale_entity_check",
          entityType
        );

        // If the calculated status differs from current status, update it
        if (isCurrentlyOnline !== shouldBeOnline) {
          await Model.findByIdAndUpdate(entity._id, {
            $set: {
              isOnline: shouldBeOnline,
              statusUpdatedAt: new Date(),
              statusSource: "stale_entity_correction",
            },
          });
          return { updated: true, entityId: entity._id };
        }

        return { updated: false, entityId: entity._id };
      }
    );

    return {
      success: true,
      processedCount: batchResult.processed,
      totalFound: staleEntities.length,
    };
  } catch (error) {
    if (error.message.includes("stopped execution")) {
      logText(`Stale ${entityType} processing stopped gracefully`);
      return {
        success: true,
        processedCount: 0,
        stopped: true,
      };
    }
    logger.error(`Error processing stale ${entityType}s: ${error.message}`);
    return {
      success: false,
      error: error.message,
      processedCount: 0,
    };
  }
}

// Enhanced offline detection with accuracy tracking and throttled logging
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

    // 1. Find all entities that should be marked as offline
    const entitiesToMarkOffline = await Model.find(
      {
        _id: { $nin: Array.from(activeEntityIds) },
        $or: [
          { lastActive: { $lt: thresholdTime } },
          { lastActive: { $exists: false }, createdAt: { $lt: thresholdTime } },
        ],
        isOnline: { $ne: false },
      },
      { _id: 1, isOnline: 1 } // Also fetch current isOnline status
    ).lean();

    const offlineEntityIds = entitiesToMarkOffline.map((e) => e._id);
    let modified = 0;

    if (offlineEntityIds.length > 0) {
      // 2. Update offline, re-validating the same conditions to avoid races.
      const writeResult = await Model.updateMany(
        {
          _id: { $in: offlineEntityIds },
          $or: [
            { lastActive: { $lt: thresholdTime } },
            {
              lastActive: { $exists: false },
              createdAt: { $lt: thresholdTime },
            },
          ],
          isOnline: { $ne: false },
        },
        {
          $set: {
            isOnline: false,
            statusUpdatedAt: new Date(),
            statusSource: "cron_offline_detection",
          },
        }
      );
      modified = writeResult?.modifiedCount || 0;

      // 3. Loop through the offline entities and update their accuracy individually.
      for (const entity of entitiesToMarkOffline) {
        await updateEntityOnlineStatusAccuracy(
          Model,
          entity._id,
          entity.isOnline, // The status that was in the DB (was true)
          false, // The new status is now false
          "device_offline_by_job",
          entityType
        );
      }
    }

    const accuracyMetrics = {
      entityType,
      totalProcessed: activeEntityIds.size,
      markedOffline: modified,
      successfulUpdates: statusResults.filter((r) => r.success).length,
      failedUpdates: statusResults.filter((r) => !r.success).length,
      timestamp: new Date(),
    };

    const formattedMetrics = `📊 ${entityType} Status: ${accuracyMetrics.totalProcessed} processed, ${accuracyMetrics.successfulUpdates} updated, ${accuracyMetrics.markedOffline} marked offline.`;
    await throttledLog("METRICS", formattedMetrics);

    return {
      success: true,
      metrics: accuracyMetrics,
      offlineCount: modified,
    };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logger.debug(
        `Duplicate key error in offline detection for ${entityType}s - continuing`
      );
      return { success: true, reason: "duplicate_ignored" };
    }
    logger.error(`Error updating offline ${entityType}s: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Online status processor focused on accuracy and metrics
class OnlineStatusProcessor {
  constructor(processor) {
    this.processor = processor;
    this.statusResults = {
      devices: [],
      sites: [],
    };
    this.processingMetrics = {
      startTime: null,
      endTime: null,
      totalDocuments: 0,
      statusUpdatesAttempted: 0,
      statusUpdatesSuccessful: 0,
      statusUpdatesFailed: 0,
    };
  }

  async processStatusUpdates(data) {
    this.processingMetrics.startTime = new Date();
    this.processingMetrics.totalDocuments = data.length;

    if (data.length === 0) {
      this.processingMetrics.endTime = new Date();
      return;
    }

    // Process data with non-blocking patterns
    const batchResult = await this.processor.processBatch(data, async (doc) => {
      const docTime = moment(doc.time).tz(TIMEZONE);
      let results = [];

      // Handle site status updates
      if (doc.site_id) {
        this.processingMetrics.statusUpdatesAttempted++;
        try {
          const result = await updateEntityStatus(
            SiteModel("airqo"),
            { _id: doc.site_id },
            docTime.toDate(),
            "Site"
          );

          this.statusResults.sites.push({
            siteId: doc.site_id,
            result: result,
            timestamp: new Date(),
          });

          if (result.success) {
            this.processingMetrics.statusUpdatesSuccessful++;
          } else {
            this.processingMetrics.statusUpdatesFailed++;
          }
          results.push({ type: "site", success: result.success });
        } catch (error) {
          logger.debug(
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
          this.processingMetrics.statusUpdatesFailed++;
          results.push({ type: "site", success: false });
        }
      }

      // Handle device status updates
      if (doc.device_id) {
        this.processingMetrics.statusUpdatesAttempted++;
        try {
          const result = await updateEntityStatus(
            DeviceModel("airqo"),
            { _id: doc.device_id },
            docTime.toDate(),
            "Device"
          );

          this.statusResults.devices.push({
            deviceId: doc.device_id,
            result: result,
            timestamp: new Date(),
          });

          if (result.success) {
            this.processingMetrics.statusUpdatesSuccessful++;
          } else {
            this.processingMetrics.statusUpdatesFailed++;
          }
          results.push({ type: "device", success: result.success });
        } catch (error) {
          logger.debug(
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
          this.processingMetrics.statusUpdatesFailed++;
          results.push({ type: "device", success: false });
        }
      }

      return results;
    });

    this.processingMetrics.endTime = new Date();
  }

  async getAccuracyReport() {
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

    // Get historical accuracy from database
    let historicalAccuracy = null;
    try {
      const [deviceStats, siteStats] = await Promise.allSettled([
        DeviceModel("airqo")
          .aggregate([
            { $match: { "onlineStatusAccuracy.totalAttempts": { $gt: 0 } } },
            {
              $group: {
                _id: null,
                avgSuccessPercentage: {
                  $avg: "$onlineStatusAccuracy.successPercentage",
                },
                avgFailurePercentage: {
                  $avg: "$onlineStatusAccuracy.failurePercentage",
                },
                totalDevices: { $sum: 1 },
                totalAttempts: { $sum: "$onlineStatusAccuracy.totalAttempts" },
                totalSuccessful: {
                  $sum: "$onlineStatusAccuracy.successfulUpdates",
                },
                totalFailed: { $sum: "$onlineStatusAccuracy.failedUpdates" },
              },
            },
          ])
          .exec(),
        SiteModel("airqo")
          .aggregate([
            { $match: { "onlineStatusAccuracy.totalAttempts": { $gt: 0 } } },
            {
              $group: {
                _id: null,
                avgSuccessPercentage: {
                  $avg: "$onlineStatusAccuracy.successPercentage",
                },
                avgFailurePercentage: {
                  $avg: "$onlineStatusAccuracy.failurePercentage",
                },
                totalSites: { $sum: 1 },
                totalAttempts: { $sum: "$onlineStatusAccuracy.totalAttempts" },
                totalSuccessful: {
                  $sum: "$onlineStatusAccuracy.successfulUpdates",
                },
                totalFailed: { $sum: "$onlineStatusAccuracy.failedUpdates" },
              },
            },
          ])
          .exec(),
      ]);

      if (
        deviceStats.status === "fulfilled" &&
        siteStats.status === "fulfilled"
      ) {
        historicalAccuracy = {
          devices: deviceStats.value[0] || null,
          sites: siteStats.value[0] || null,
        };
      }
    } catch (error) {
      logger.debug(
        `Could not fetch historical accuracy stats: ${error.message}`
      );
    }

    const baseReport = {
      processing: this.processingMetrics,
      sessionAccuracy: {
        deviceOnlineStatusAccuracy: {
          totalUpdates: this.statusResults.devices.length,
          successRate: Math.round(deviceSuccessRate * 100) / 100,
          failureReasons: this.getFailureReasons(this.statusResults.devices),
        },
        siteOnlineStatusAccuracy: {
          totalUpdates: this.statusResults.sites.length,
          successRate: Math.round(siteSuccessRate * 100) / 100,
          failureReasons: this.getFailureReasons(this.statusResults.sites),
        },
      },
      overallAccuracy: {
        processingDuration:
          this.processingMetrics.endTime - this.processingMetrics.startTime,
        statusUpdateSuccessRate:
          this.processingMetrics.statusUpdatesAttempted > 0
            ? Math.round(
                (this.processingMetrics.statusUpdatesSuccessful /
                  this.processingMetrics.statusUpdatesAttempted) *
                  10000
              ) / 100
            : 0,
      },
    };

    if (historicalAccuracy) {
      baseReport.historicalAccuracy = {
        devices: historicalAccuracy.devices
          ? {
              averageSuccessRate:
                Math.round(
                  (historicalAccuracy.devices.avgSuccessPercentage || 0) * 100
                ) / 100,
              averageFailureRate:
                Math.round(
                  (historicalAccuracy.devices.avgFailurePercentage || 0) * 100
                ) / 100,
              totalDevicesTracked: historicalAccuracy.devices.totalDevices || 0,
              lifetimeAttempts: historicalAccuracy.devices.totalAttempts || 0,
              lifetimeSuccessful:
                historicalAccuracy.devices.totalSuccessful || 0,
              lifetimeFailed: historicalAccuracy.devices.totalFailed || 0,
            }
          : null,
        sites: historicalAccuracy.sites
          ? {
              averageSuccessRate:
                Math.round(
                  (historicalAccuracy.sites.avgSuccessPercentage || 0) * 100
                ) / 100,
              averageFailureRate:
                Math.round(
                  (historicalAccuracy.sites.avgFailurePercentage || 0) * 100
                ) / 100,
              totalSitesTracked: historicalAccuracy.sites.totalSites || 0,
              lifetimeAttempts: historicalAccuracy.sites.totalAttempts || 0,
              lifetimeSuccessful: historicalAccuracy.sites.totalSuccessful || 0,
              lifetimeFailed: historicalAccuracy.sites.totalFailed || 0,
            }
          : null,
      };
    }

    return baseReport;
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

// Main function focused on online status updates
async function updateOnlineStatusAndAccuracy() {
  const processor = new NonBlockingJobProcessor(JOB_NAME);
  const statusProcessor = new OnlineStatusProcessor(processor);
  let staleProcessingStats = null;

  try {
    processor.start();

    const request = {
      query: {
        tenant: "airqo",
        recent: "yes",
        metadata: "site_id",
        internal: "yes",
        active: "yes",
        brief: "yes",
        limit: 5000, // Add reasonable limit to prevent memory issues
      },
    };
    const filter = generateFilter.fetch(request);

    logText("Starting online status and accuracy tracking job");

    let viewEventsResponse;
    try {
      // Add timeout to prevent hanging
      const FETCH_TIMEOUT = 30000; // 30 seconds
      viewEventsResponse = await Promise.race([
        EventModel("airqo").fetch(filter),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Fetch timeout")), FETCH_TIMEOUT)
        ),
      ]);
    } catch (fetchError) {
      if (isDuplicateKeyError(fetchError)) {
        logText("Ignoring duplicate key error in fetch operation");
        return;
      }
      logger.error(`🐛 Error fetching events: ${stringify(fetchError)}`);

      // Don't fail completely - try to process stale entities
      viewEventsResponse = { success: false, data: [] };
    }

    // Process events if available with memory management
    let deviceIds = new Set();
    let siteIds = new Set();

    if (
      viewEventsResponse?.success &&
      Array.isArray(viewEventsResponse.data?.[0]?.data) &&
      viewEventsResponse.data[0].data.length > 0
    ) {
      const data = viewEventsResponse.data[0].data;

      // Process in smaller chunks to prevent memory issues
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < data.length; i += CHUNK_SIZE) {
        if (processor.shouldStopExecution()) break;

        const chunk = data.slice(i, i + CHUNK_SIZE);
        await statusProcessor.processStatusUpdates(chunk);

        // Collect IDs from this chunk
        chunk.forEach((doc) => {
          if (doc.device_id) deviceIds.add(doc.device_id);
          if (doc.site_id) siteIds.add(doc.site_id);
        });

        // Yield control periodically
        await processor.yieldControl();
      }
    } else {
      logText("No Events found for status updates from recent data");
    }

    // Process stale entities with better error handling
    if (!processor.shouldStopExecution()) {
      logText(
        "Processing stale entities that haven't been checked recently..."
      );

      try {
        const [staleDeviceResult, staleSiteResult] = await Promise.allSettled([
          Promise.race([
            processStaleEntities(DeviceModel("airqo"), "Device", processor),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Stale device processing timeout")),
                25000
              )
            ),
          ]),
          Promise.race([
            processStaleEntities(SiteModel("airqo"), "Site", processor),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Stale site processing timeout")),
                25000
              )
            ),
          ]),
        ]);

        staleProcessingStats = {
          devices:
            staleDeviceResult.status === "fulfilled"
              ? staleDeviceResult.value
              : {
                  processedCount: 0,
                  error: staleDeviceResult.reason?.message || "Unknown error",
                },
          sites:
            staleSiteResult.status === "fulfilled"
              ? staleSiteResult.value
              : {
                  processedCount: 0,
                  error: staleSiteResult.reason?.message || "Unknown error",
                },
        };

        logText(
          `Processed ${staleProcessingStats.devices.processedCount} stale devices, ${staleProcessingStats.sites.processedCount} stale sites`
        );
      } catch (error) {
        logger.error(`Error in stale entity processing: ${error.message}`);
        staleProcessingStats = {
          devices: { processedCount: 0, error: error.message },
          sites: { processedCount: 0, error: error.message },
        };
      }
    }

    // Enhanced offline detection with better memory management
    if (!processor.shouldStopExecution()) {
      try {
        await processor.yieldControl();

        // Process offline detection with timeouts
        const OFFLINE_TIMEOUT = 20000; // 20 seconds
        const [
          deviceOfflineResult,
          siteOfflineResult,
        ] = await Promise.allSettled([
          Promise.race([
            updateOfflineEntitiesWithAccuracy(
              DeviceModel("airqo"),
              deviceIds,
              "Device",
              statusProcessor.statusResults.devices.map((d) => d.result)
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Device offline detection timeout")),
                OFFLINE_TIMEOUT
              )
            ),
          ]),
          Promise.race([
            updateOfflineEntitiesWithAccuracy(
              SiteModel("airqo"),
              siteIds,
              "Site",
              statusProcessor.statusResults.sites.map((s) => s.result)
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Site offline detection timeout")),
                OFFLINE_TIMEOUT
              )
            ),
          ]),
        ]);

        // Generate comprehensive accuracy report with error handling
        const accuracyReport = await statusProcessor.getAccuracyReport();
        accuracyReport.offlineDetection = {
          devices:
            deviceOfflineResult.status === "fulfilled"
              ? deviceOfflineResult.value
              : {
                  success: false,
                  error: deviceOfflineResult.reason?.message || "Unknown error",
                },
          sites:
            siteOfflineResult.status === "fulfilled"
              ? siteOfflineResult.value
              : {
                  success: false,
                  error: siteOfflineResult.reason?.message || "Unknown error",
                },
        };

        // Add stale processing stats to report
        if (staleProcessingStats) {
          accuracyReport.staleProcessing = staleProcessingStats;
        }

        // Format a more concise summary to reduce log noise
        const {
          processing,
          overallAccuracy,
          offlineDetection,
          staleProcessing,
        } = accuracyReport;
        const durationMs =
          typeof overallAccuracy?.processingDuration === "number"
            ? overallAccuracy.processingDuration
            : processing.endTime && processing.startTime
            ? processing.endTime - processing.startTime
            : 0;
        const duration = (durationMs / 1000).toFixed(1);

        const devices = offlineDetection?.devices?.metrics;
        const sites = offlineDetection?.sites?.metrics;

        const formattedReport =
          `📊 Online Status Report: ${duration}s | ` +
          `Devices: ${
            devices
              ? `${devices.successfulUpdates}↑ ${devices.markedOffline}↓`
              : "N/A"
          } | ` +
          `Sites: ${
            sites
              ? `${sites.successfulUpdates}↑ ${sites.markedOffline}↓`
              : "N/A"
          }` +
          (staleProcessing
            ? ` | Stale: ${staleProcessing.devices.processedCount}D ${staleProcessing.sites.processedCount}S`
            : "");

        // Use throttled logging for accuracy report
        await throttledLog("ACCURACY_REPORT", formattedReport);
      } catch (offlineError) {
        logger.error(`Error in offline detection: ${offlineError.message}`);
        const accuracyReport = await statusProcessor.getAccuracyReport();
        const { processing } = accuracyReport;
        const duration =
          processing.endTime && processing.startTime
            ? ((processing.endTime - processing.startTime) / 1000).toFixed(1)
            : "unknown";
        const formattedReport = `📊 PARTIAL Online Status Report: ${duration}s | Check logs for errors`;
        await throttledLog("ACCURACY_REPORT", formattedReport);
      }
    }

    logText("Online status and accuracy tracking completed successfully");
  } catch (error) {
    if (error.message.includes("stopped execution")) {
      logText(`${JOB_NAME} stopped gracefully during execution`);
    } else if (isDuplicateKeyError(error)) {
      logText(
        "Online status processing completed with some duplicate entries (ignored)"
      );
    } else {
      logger.error(`🐛 Error in online status processing: ${stringify(error)}`);
    }
  } finally {
    processor.end();

    // Force garbage collection if available (helps with memory management)
    if (global.gc) {
      global.gc();
    }
  }
}

// Create and register the job
const startJob = () => {
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    logger.warn(`${JOB_NAME} already registered. Skipping duplicate start.`);
    return;
  }

  // Initialize global cronJobs if it doesn't exist
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  let isJobRunning = false;
  let currentJobPromise = null;

  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    async () => {
      if (isJobRunning) {
        logger.warn(`${JOB_NAME} is already running, skipping this execution.`);
        return;
      }

      isJobRunning = true;
      currentJobPromise = updateOnlineStatusAndAccuracy();

      try {
        await currentJobPromise;
      } catch (error) {
        logger.error(
          `🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`
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

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      logText(`🛑 Stopping ${JOB_NAME}...`);
      cronJobInstance.stop();
      logText(`📅 ${JOB_NAME} schedule stopped.`);

      if (currentJobPromise) {
        logText(`⏳ Waiting for current ${JOB_NAME} execution to finish...`);
        try {
          await Promise.race([
            currentJobPromise,
            new Promise(
              (_, reject) =>
                setTimeout(() => reject(new Error("Job stop timeout")), 45000) // Longer timeout for this job
            ),
          ]);
          logText(`✅ Current ${JOB_NAME} execution completed.`);
        } catch (error) {
          logger.warn(`${JOB_NAME} stop timeout: ${error.message}`);
        }
      }

      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      delete global.cronJobs[JOB_NAME];
      logText(`🧹 ${JOB_NAME} removed from job registry.`);
    },
  };

  console.log(
    `✅ ${JOB_NAME} started with non-blocking patterns - will log summary around 12:00 EAT (max ${LOG_THROTTLE_CONFIG.maxLogsPerDay} report per day)`
  );
};

startJob();

// Export for testing purposes
module.exports = {
  updateOnlineStatusAndAccuracy,
  OnlineStatusProcessor,
  LogThrottleManager,
  updateEntityStatus,
  isEntityActive,
  updateOfflineEntitiesWithAccuracy,
  updateEntityOnlineStatusAccuracy,
  isDuplicateKeyError,
  validateTimestamp,
  throttledLog,
  processStaleEntities,
  NonBlockingJobProcessor,
};
