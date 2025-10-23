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
const INACTIVE_THRESHOLD = 5 * 60 * 60 * 1000;
const STALE_ACCURACY_THRESHOLD = 24 * 60 * 60 * 1000;
const MAX_EXECUTION_TIME = 15 * 60 * 1000;
const YIELD_INTERVAL = 10;
const STALE_BATCH_SIZE = 30;
const FETCH_BATCH_SIZE = 200; // Fetch events in batches to avoid slow queries
const MAX_FETCH_ITERATIONS = 10; // Safety limit
const STATUS_UPDATE_BATCH_SIZE = 500;

const JOB_NAME = "update-online-status-job";
const JOB_SCHEDULE = "45 * * * *";

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
      const result = await this.model.incrementCount({
        date: today,
        logType: logType,
        environment: this.environment,
      });

      if (result.success) {
        const currentCount = result.data?.count || 1;
        return currentCount <= LOG_THROTTLE_CONFIG.maxLogsPerDay;
      } else {
        logger.debug(`Log throttle increment failed: ${result.message}`);
        return true;
      }
    } catch (error) {
      if (error.code === 11000) {
        try {
          const countResult = await this.model.getCurrentCount({
            date: today,
            logType: logType,
            environment: this.environment,
          });

          if (countResult.success && countResult.data.exists) {
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
        return LOG_THROTTLE_CONFIG.maxLogsPerDay;
      }
    } catch (error) {
      logger.debug(`Failed to get remaining log count: ${error.message}`);
      return LOG_THROTTLE_CONFIG.maxLogsPerDay;
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
    logText(message);
    return;
  }

  try {
    const now = moment().tz("Africa/Nairobi");
    const currentHour = now.hour();

    if (currentHour !== 12) {
      logger.debug(
        `Skipping log for ${logType} outside of the 12:00-12:59 EAT window.`
      );
      return;
    }
    const shouldAllow = await logThrottleManager.shouldAllowLog(logType);

    if (shouldAllow) {
      logText(message);
    } else {
      logger.debug(
        `Log throttled for ${logType}: Daily limit of ${LOG_THROTTLE_CONFIG.maxLogsPerDay} reached for the 12 PM window.`
      );
    }
  } catch (error) {
    logText(message);
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

// Optimized batch entity status update
async function updateEntityStatusBatch(Model, updates, entityType) {
  if (!updates || updates.length === 0) {
    return { success: true, modified: 0, accuracyUpdates: [] };
  }

  try {
    const entityIds = updates.map((u) => u.filter._id);
    const currentEntities = await Model.find(
      { _id: { $in: entityIds } },
      { _id: 1, isOnline: 1 }
    ).lean();

    const entityMap = new Map(
      currentEntities.map((e) => [e._id.toString(), e])
    );
    const bulkOps = [];
    const accuracyBulkOps = [];

    for (const update of updates) {
      const entityId = update.filter._id;
      const entity = entityMap.get(entityId.toString());

      if (!entity) continue;

      const validationResult = validateTimestamp(update.time);
      if (!validationResult.isValid) {
        const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
          isCurrentlyOnline: entity.isOnline,
          isNowOnline: false,
          currentStats: {},
          reason: `invalid_timestamp: ${validationResult.reason}`,
        });

        accuracyBulkOps.push({
          updateOne: {
            filter: { _id: entityId },
            update: { $inc: incUpdate, $set: setUpdate },
          },
        });
        continue;
      }

      const isNowOnline = isEntityActive(validationResult.validTime);
      const lastActiveTime = moment(validationResult.validTime)
        .tz(TIMEZONE)
        .toDate();

      bulkOps.push({
        updateOne: {
          filter: { _id: entityId },
          update: {
            $set: {
              lastActive: lastActiveTime,
              isOnline: isNowOnline,
              statusUpdatedAt: new Date(),
              statusSource: "online_status_cron_job",
            },
          },
        },
      });

      const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
        isCurrentlyOnline: entity.isOnline,
        isNowOnline: isNowOnline,
        currentStats: {},
        reason:
          entity.isOnline === isNowOnline
            ? "status_confirmed"
            : "status_corrected",
      });

      accuracyBulkOps.push({
        updateOne: {
          filter: { _id: entityId },
          update: { $inc: incUpdate, $set: setUpdate },
        },
      });
    }

    let modified = 0;
    if (bulkOps.length > 0) {
      const result = await Model.bulkWrite(bulkOps, { ordered: false });
      modified = result.modifiedCount || 0;
    }

    if (accuracyBulkOps.length > 0) {
      await Model.bulkWrite(accuracyBulkOps, { ordered: false });
    }

    return {
      success: true,
      modified,
      processed: updates.length,
    };
  } catch (error) {
    logger.error(`Batch update error for ${entityType}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Optimized offline detection with batched accuracy updates
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

    const entitiesToMarkOffline = await Model.find(
      {
        _id: { $nin: Array.from(activeEntityIds) },
        $or: [
          { lastActive: { $lt: thresholdTime } },
          { lastActive: { $exists: false }, createdAt: { $lt: thresholdTime } },
        ],
        isOnline: { $ne: false },
      },
      { _id: 1, isOnline: 1 }
    ).lean();

    if (entitiesToMarkOffline.length === 0) {
      return {
        success: true,
        metrics: {
          entityType,
          totalProcessed: activeEntityIds.size,
          markedOffline: 0,
          successfulUpdates: statusResults.filter((r) => r.success).length,
          failedUpdates: statusResults.filter((r) => !r.success).length,
        },
        offlineCount: 0,
      };
    }

    const statusBulkOps = [];
    const accuracyBulkOps = [];

    for (const entity of entitiesToMarkOffline) {
      statusBulkOps.push({
        updateOne: {
          filter: {
            _id: entity._id,
            $or: [
              { lastActive: { $lt: thresholdTime } },
              {
                lastActive: { $exists: false },
                createdAt: { $lt: thresholdTime },
              },
            ],
            isOnline: { $ne: false },
          },
          update: {
            $set: {
              isOnline: false,
              statusUpdatedAt: new Date(),
              statusSource: "cron_offline_detection",
            },
          },
        },
      });

      const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
        isCurrentlyOnline: entity.isOnline,
        isNowOnline: false,
        currentStats: {},
        reason: "device_offline_by_job",
      });

      accuracyBulkOps.push({
        updateOne: {
          filter: { _id: entity._id },
          update: { $inc: incUpdate, $set: setUpdate },
        },
      });
    }

    let modified = 0;
    if (statusBulkOps.length > 0) {
      const statusResult = await Model.bulkWrite(statusBulkOps, {
        ordered: false,
      });
      modified = statusResult.modifiedCount || 0;
    }

    if (accuracyBulkOps.length > 0) {
      await Model.bulkWrite(accuracyBulkOps, { ordered: false });
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
    logger.error(`Error updating offline ${entityType}s: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Optimized stale entity processing with batching
async function processStaleEntities(Model, entityType, processor) {
  try {
    const staleThreshold = new Date(Date.now() - STALE_ACCURACY_THRESHOLD);

    const staleEntities = await Model.find(
      {
        $or: [
          { "onlineStatusAccuracy.lastCheck": { $exists: false } },
          { "onlineStatusAccuracy.lastCheck": { $lt: staleThreshold } },
        ],
      },
      { _id: 1, isOnline: 1, lastActive: 1 }
    )
      .limit(STALE_BATCH_SIZE)
      .lean();

    if (staleEntities.length === 0) {
      return { success: true, processedCount: 0, totalFound: 0 };
    }

    const statusBulkOps = [];
    const accuracyBulkOps = [];

    for (const entity of staleEntities) {
      if (processor.shouldStopExecution()) break;

      const isCurrentlyOnline = entity.isOnline;
      const shouldBeOnline = isEntityActive(entity.lastActive);

      const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
        isCurrentlyOnline,
        isNowOnline: shouldBeOnline,
        currentStats: {},
        reason: "stale_entity_check",
      });

      accuracyBulkOps.push({
        updateOne: {
          filter: { _id: entity._id },
          update: { $inc: incUpdate, $set: setUpdate },
        },
      });

      if (isCurrentlyOnline !== shouldBeOnline) {
        statusBulkOps.push({
          updateOne: {
            filter: { _id: entity._id },
            update: {
              $set: {
                isOnline: shouldBeOnline,
                statusUpdatedAt: new Date(),
                statusSource: "stale_entity_correction",
              },
            },
          },
        });
      }
    }

    if (statusBulkOps.length > 0) {
      await Model.bulkWrite(statusBulkOps, { ordered: false });
    }

    if (accuracyBulkOps.length > 0) {
      await Model.bulkWrite(accuracyBulkOps, { ordered: false });
    }

    return {
      success: true,
      processedCount: staleEntities.length,
      totalFound: staleEntities.length,
    };
  } catch (error) {
    if (error.message.includes("stopped execution")) {
      return { success: true, processedCount: 0, stopped: true };
    }
    logger.error(`Error processing stale ${entityType}s: ${error.message}`);
    return { success: false, error: error.message, processedCount: 0 };
  }
}

// Optimized status processor with batching
class OnlineStatusProcessor {
  constructor(processor) {
    this.processor = processor;
    this.deviceUpdates = [];
    this.siteUpdates = [];
    this.statusResults = { devices: [], sites: [] };
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

    for (const doc of data) {
      if (this.processor.shouldStopExecution()) break;

      const docTime = moment(doc.time)
        .tz(TIMEZONE)
        .toDate();

      if (doc.site_id) {
        this.siteUpdates.push({
          filter: { _id: doc.site_id },
          time: docTime,
        });
      }

      if (doc.device_id) {
        this.deviceUpdates.push({
          filter: { _id: doc.device_id },
          time: docTime,
        });
      }
    }

    await this.flushUpdates();
    this.processingMetrics.endTime = new Date();
  }

  async flushUpdates() {
    if (this.deviceUpdates.length > 0) {
      for (
        let i = 0;
        i < this.deviceUpdates.length;
        i += STATUS_UPDATE_BATCH_SIZE
      ) {
        if (this.processor.shouldStopExecution()) break;

        const batch = this.deviceUpdates.slice(i, i + STATUS_UPDATE_BATCH_SIZE);
        this.processingMetrics.statusUpdatesAttempted += batch.length;

        const result = await updateEntityStatusBatch(
          DeviceModel("airqo"),
          batch,
          "Device"
        );

        if (result.success) {
          this.processingMetrics.statusUpdatesSuccessful += result.modified;
          this.statusResults.devices.push({
            batchSize: batch.length,
            modified: result.modified,
            success: true,
          });
        } else {
          this.processingMetrics.statusUpdatesFailed += batch.length;
          this.statusResults.devices.push({
            batchSize: batch.length,
            success: false,
            error: result.error,
          });
        }

        await this.processor.yieldControl();
      }
    }

    if (this.siteUpdates.length > 0) {
      for (
        let i = 0;
        i < this.siteUpdates.length;
        i += STATUS_UPDATE_BATCH_SIZE
      ) {
        if (this.processor.shouldStopExecution()) break;

        const batch = this.siteUpdates.slice(i, i + STATUS_UPDATE_BATCH_SIZE);
        this.processingMetrics.statusUpdatesAttempted += batch.length;

        const result = await updateEntityStatusBatch(
          SiteModel("airqo"),
          batch,
          "Site"
        );

        if (result.success) {
          this.processingMetrics.statusUpdatesSuccessful += result.modified;
          this.statusResults.sites.push({
            batchSize: batch.length,
            modified: result.modified,
            success: true,
          });
        } else {
          this.processingMetrics.statusUpdatesFailed += batch.length;
          this.statusResults.sites.push({
            batchSize: batch.length,
            success: false,
            error: result.error,
          });
        }

        await this.processor.yieldControl();
      }
    }

    this.deviceUpdates = [];
    this.siteUpdates = [];
  }

  async getAccuracyReport() {
    this.processingMetrics.endTime = new Date();

    const deviceSuccessRate =
      this.statusResults.devices.length > 0
        ? (this.statusResults.devices.filter((d) => d.success).length /
            this.statusResults.devices.length) *
          100
        : 0;

    const siteSuccessRate =
      this.statusResults.sites.length > 0
        ? (this.statusResults.sites.filter((s) => s.success).length /
            this.statusResults.sites.length) *
          100
        : 0;

    let historicalAccuracy = null;
    try {
      const [deviceStats, siteStats] = await Promise.all([
        DeviceModel("airqo")
          .aggregate([
            { $match: { "onlineStatusAccuracy.totalChecks": { $gt: 0 } } },
            {
              $group: {
                _id: null,
                avgAccuracy: {
                  $avg: "$onlineStatusAccuracy.accuracyPercentage",
                },
                totalDevices: { $sum: 1 },
                totalChecks: { $sum: "$onlineStatusAccuracy.totalChecks" },
                totalCorrect: { $sum: "$onlineStatusAccuracy.correctChecks" },
              },
            },
          ])
          .exec(),
        SiteModel("airqo")
          .aggregate([
            { $match: { "onlineStatusAccuracy.totalChecks": { $gt: 0 } } },
            {
              $group: {
                _id: null,
                avgAccuracy: {
                  $avg: "$onlineStatusAccuracy.accuracyPercentage",
                },
                totalSites: { $sum: 1 },
                totalChecks: { $sum: "$onlineStatusAccuracy.totalChecks" },
                totalCorrect: { $sum: "$onlineStatusAccuracy.correctChecks" },
              },
            },
          ])
          .exec(),
      ]);

      historicalAccuracy = {
        devices: deviceStats[0] || null,
        sites: siteStats[0] || null,
      };
    } catch (error) {
      logger.debug(`Could not fetch historical accuracy: ${error.message}`);
    }

    return {
      processing: this.processingMetrics,
      sessionAccuracy: {
        deviceOnlineStatusAccuracy: {
          totalBatches: this.statusResults.devices.length,
          successRate: Math.round(deviceSuccessRate * 100) / 100,
        },
        siteOnlineStatusAccuracy: {
          totalBatches: this.statusResults.sites.length,
          successRate: Math.round(siteSuccessRate * 100) / 100,
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
      historicalAccuracy,
    };
  }

  getFailureReasons(statusResults) {
    const failureReasons = {};
    statusResults
      .filter((item) => !item.success)
      .forEach((item) => {
        const reason = item.error || "unknown";
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      });
    return failureReasons;
  }
}

// Fetch all recent events in batches
async function fetchAllRecentEvents(processor) {
  let allEvents = [];
  let skip = 0;
  let hasMore = true;
  let iteration = 0;

  logText("Fetching recent events in batches...");

  while (hasMore && iteration < MAX_FETCH_ITERATIONS) {
    if (processor.shouldStopExecution()) {
      logText("Fetch stopped due to execution timeout");
      break;
    }

    try {
      const request = {
        query: {
          tenant: "airqo",
          recent: "yes",
          metadata: "site_id",
          internal: "yes",
          active: "yes",
          brief: "yes",
          limit: FETCH_BATCH_SIZE,
          skip: skip,
        },
      };

      const filter = generateFilter.fetch(request);
      const fetchOptions = {
        ...filter,
        isHistorical: true,
      };

      const FETCH_TIMEOUT = 30000;
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

          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } else {
        hasMore = false;
        if (iteration === 0) {
          logText("No recent events found");
        }
      }
    } catch (error) {
      logger.error(`Error fetching batch ${iteration + 1}: ${error.message}`);
      hasMore = false;
    }
  }

  if (iteration >= MAX_FETCH_ITERATIONS) {
    logText(`Reached maximum fetch iterations (${MAX_FETCH_ITERATIONS})`);
  }

  logText(`Total events fetched: ${allEvents.length}`);
  return allEvents;
}

// Main update function - OPTIMIZED with batched fetching
async function updateOnlineStatusAndAccuracy() {
  const processor = new NonBlockingJobProcessor(JOB_NAME);
  const statusProcessor = new OnlineStatusProcessor(processor);
  let staleProcessingStats = null;

  try {
    processor.start();

    logText("Starting optimized online status job with batched fetching");

    const allEvents = await fetchAllRecentEvents(processor);

    let deviceIds = new Set();
    let siteIds = new Set();

    if (allEvents.length > 0) {
      await statusProcessor.processStatusUpdates(allEvents);

      allEvents.forEach((doc) => {
        if (doc.device_id) deviceIds.add(doc.device_id);
        if (doc.site_id) siteIds.add(doc.site_id);
      });

      logText(
        `Unique devices: ${deviceIds.size}, Unique sites: ${siteIds.size}`
      );
    } else {
      logText("No events to process");
    }

    if (!processor.shouldStopExecution()) {
      logText("Processing stale entities...");

      try {
        const STALE_TIMEOUT = 25000;
        const [staleDeviceResult, staleSiteResult] = await Promise.allSettled([
          Promise.race([
            processStaleEntities(DeviceModel("airqo"), "Device", processor),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Stale device timeout")),
                STALE_TIMEOUT
              )
            ),
          ]),
          Promise.race([
            processStaleEntities(SiteModel("airqo"), "Site", processor),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Stale site timeout")),
                STALE_TIMEOUT
              )
            ),
          ]),
        ]);

        staleProcessingStats = {
          devices:
            staleDeviceResult.status === "fulfilled"
              ? staleDeviceResult.value
              : { processedCount: 0, error: staleDeviceResult.reason?.message },
          sites:
            staleSiteResult.status === "fulfilled"
              ? staleSiteResult.value
              : { processedCount: 0, error: staleSiteResult.reason?.message },
        };

        logText(
          `Stale processing: ${staleProcessingStats.devices.processedCount}D, ${staleProcessingStats.sites.processedCount}S`
        );
      } catch (error) {
        logger.error(`Error in stale processing: ${error.message}`);
      }
    }

    if (!processor.shouldStopExecution()) {
      try {
        const OFFLINE_TIMEOUT = 20000;
        const [deviceOfflineResult, siteOfflineResult] = await Promise.all([
          Promise.race([
            updateOfflineEntitiesWithAccuracy(
              DeviceModel("airqo"),
              deviceIds,
              "Device",
              statusProcessor.statusResults.devices
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Device offline timeout")),
                OFFLINE_TIMEOUT
              )
            ),
          ]),
          Promise.race([
            updateOfflineEntitiesWithAccuracy(
              SiteModel("airqo"),
              siteIds,
              "Site",
              statusProcessor.statusResults.sites
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Site offline timeout")),
                OFFLINE_TIMEOUT
              )
            ),
          ]),
        ]);

        const accuracyReport = await statusProcessor.getAccuracyReport();
        accuracyReport.offlineDetection = {
          devices: deviceOfflineResult.value || {
            error: deviceOfflineResult.reason?.message,
          },
          sites: siteOfflineResult.value || {
            error: siteOfflineResult.reason?.message,
          },
        };

        if (staleProcessingStats) {
          accuracyReport.staleProcessing = staleProcessingStats;
        }

        const duration = (
          (accuracyReport.overallAccuracy?.processingDuration || 0) / 1000
        ).toFixed(1);

        const formattedReport =
          `📊 Report: ${duration}s | ` +
          `Devices: ${accuracyReport.offlineDetection.devices?.metrics
            ?.successfulUpdates || 0}↑ ` +
          `${accuracyReport.offlineDetection.devices?.offlineCount || 0}↓ | ` +
          `Sites: ${accuracyReport.offlineDetection.sites?.metrics
            ?.successfulUpdates || 0}↑ ` +
          `${accuracyReport.offlineDetection.sites?.offlineCount || 0}↓`;

        await throttledLog("ACCURACY_REPORT", formattedReport);
      } catch (error) {
        logger.error(`Error in offline detection: ${error.message}`);
      }
    }

    logText("Online status job completed");
  } catch (error) {
    if (error.message.includes("stopped execution")) {
      logText(`${JOB_NAME} stopped gracefully`);
    } else {
      logger.error(`${JOB_NAME} error: ${error.message}`);
    }
  } finally {
    processor.end();
  }
}

// Graceful shutdown handler
function setupGracefulShutdown() {
  const shutdownHandler = (signal) => {
    logText(`${signal} received for ${JOB_NAME}`);
    global.isShuttingDown = true;
  };

  process.on("SIGTERM", () => shutdownHandler("SIGTERM"));
  process.on("SIGINT", () => shutdownHandler("SIGINT"));
}

// Initialize and start the cron job
function startCronJob() {
  logText(`Setting up ${JOB_NAME} with schedule: ${JOB_SCHEDULE}`);

  setupGracefulShutdown();

  const task = cron.schedule(
    JOB_SCHEDULE,
    async () => {
      if (global.isShuttingDown) {
        logText(`Skipping ${JOB_NAME} execution due to shutdown`);
        return;
      }

      try {
        await updateOnlineStatusAndAccuracy();
      } catch (error) {
        logger.error(`${JOB_NAME} execution failed: ${error.message}`);
      }
    },
    {
      scheduled: true,
      timezone: TIMEZONE,
    }
  );

  logText(`${JOB_NAME} scheduled successfully`);

  return task;
}

// Auto-start when module is loaded (works for both direct run and require)
startCronJob();
logger.info(`${JOB_NAME} is now running`);

// Export for manual control if needed
module.exports = {
  startCronJob,
  updateOnlineStatusAndAccuracy,
};
