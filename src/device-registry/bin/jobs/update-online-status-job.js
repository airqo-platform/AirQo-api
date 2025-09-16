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
const { stringify, generateFilter } = require("@utils/common");
const cron = require("node-cron");
const moment = require("moment-timezone");

// Constants
const TIMEZONE = moment.tz.guess();
const INACTIVE_THRESHOLD = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

const JOB_NAME = "update-online-status-job";
const JOB_SCHEDULE = "45 * * * *"; // At minute 45 of every hour (15 minutes after readings job)

// Log throttling configuration
const LOG_THROTTLE_CONFIG = {
  maxLogsPerDay: 2,
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
    const shouldAllow = await logThrottleManager.shouldAllowLog(logType);

    if (shouldAllow) {
      logger.info(message);
    } else {
      // Log throttling is working. A debug log is sufficient to avoid noise.
      logger.debug(
        `Log throttled for ${logType}: Daily limit of ${LOG_THROTTLE_CONFIG.maxLogsPerDay} reached.`
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
  isSuccess,
  reason,
  entityType
) {
  try {
    const entity = await Model.findById(entityId, {
      "onlineStatusAccuracy.totalAttempts": 1,
      "onlineStatusAccuracy.successfulUpdates": 1,
      "onlineStatusAccuracy.failedUpdates": 1,
    });

    const currentStats = entity?.onlineStatusAccuracy || {};
    const currentTotal = currentStats.totalAttempts || 0;
    const currentSuccessful = currentStats.successfulUpdates || 0;
    const currentFailed = currentStats.failedUpdates || 0;

    const newTotal = currentTotal + 1;
    const newSuccessful = isSuccess ? currentSuccessful + 1 : currentSuccessful;
    const newFailed = isSuccess ? currentFailed : currentFailed + 1;

    const successPercentage =
      newTotal > 0 ? Math.round((newSuccessful / newTotal) * 10000) / 100 : 0;
    const failurePercentage =
      newTotal > 0 ? Math.round((newFailed / newTotal) * 10000) / 100 : 0;

    const incUpdate = {
      "onlineStatusAccuracy.totalAttempts": 1,
      ...(isSuccess
        ? { "onlineStatusAccuracy.successfulUpdates": 1 }
        : { "onlineStatusAccuracy.failedUpdates": 1 }),
    };

    const setUpdate = {
      "onlineStatusAccuracy.lastUpdate": new Date(),
      "onlineStatusAccuracy.successPercentage": successPercentage,
      "onlineStatusAccuracy.failurePercentage": failurePercentage,
      ...(isSuccess
        ? { "onlineStatusAccuracy.lastSuccessfulUpdate": new Date() }
        : { "onlineStatusAccuracy.lastFailureReason": reason }),
    };

    await Model.findByIdAndUpdate(
      entityId,
      { $inc: incUpdate, $set: setUpdate },
      { upsert: false }
    );

    return {
      success: true,
      stats: {
        totalAttempts: newTotal,
        successfulUpdates: newSuccessful,
        failedUpdates: newFailed,
        successPercentage,
        failurePercentage,
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
  try {
    const validationResult = validateTimestamp(time);
    if (!validationResult.isValid) {
      logger.debug(
        `Invalid timestamp for ${entityType}: ${validationResult.reason} - ${time}`
      );
      try {
        const entity = await Model.findOne(filter, { _id: 1 });
        if (entity) {
          entityId = entity._id;
          await updateEntityOnlineStatusAccuracy(
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

    const result = await Model.findOneAndUpdate(
      filter,
      {
        $set: {
          lastActive: lastActiveTime,
          isOnline: isActive,
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
      entityId = result._id;
      const accuracyResult = await updateEntityOnlineStatusAccuracy(
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
        accuracyStats: accuracyResult.success ? accuracyResult.stats : null,
      };
    } else {
      logger.debug(`${entityType} not found with filter: ${stringify(filter)}`);
      return { success: false, reason: "entity_not_found" };
    }
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      if (entityId) {
        await updateEntityOnlineStatusAccuracy(
          Model,
          entityId,
          false,
          "duplicate_key",
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
        false,
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

    const accuracyMetrics = {
      entityType,
      totalProcessed: activeEntityIds.size,
      markedOffline: modified,
      successfulUpdates: statusResults.filter((r) => r.success).length,
      failedUpdates: statusResults.filter((r) => !r.success).length,
      timestamp: new Date(),
    };

    await throttledLog(
      "METRICS",
      `📊 ${entityType} Status Update Metrics: ${stringify(accuracyMetrics)}`
    );

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
  constructor() {
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

    for (const doc of data) {
      const docTime = moment(doc.time).tz(TIMEZONE);

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
        }
      }
    }
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
  const processor = new OnlineStatusProcessor();

  try {
    const request = {
      query: {
        tenant: "airqo",
        recent: "yes",
        metadata: "site_id",
        internal: "yes",
        active: "yes",
        brief: "yes",
      },
    };
    const filter = generateFilter.fetch(request);

    logText("Starting online status and accuracy tracking job");

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
      logText("No Events found for status updates");
      return;
    }

    // Process status updates
    await processor.processStatusUpdates(data);

    // Enhanced offline detection
    const deviceIds = new Set(data.map((doc) => doc.device_id).filter(Boolean));
    const siteIds = new Set(data.map((doc) => doc.site_id).filter(Boolean));

    try {
      const [deviceOfflineResult, siteOfflineResult] = await Promise.allSettled(
        [
          updateOfflineEntitiesWithAccuracy(
            DeviceModel("airqo"),
            deviceIds,
            "Device",
            processor.statusResults.devices.map((d) => d.result)
          ),
          updateOfflineEntitiesWithAccuracy(
            SiteModel("airqo"),
            siteIds,
            "Site",
            processor.statusResults.sites.map((s) => s.result)
          ),
        ]
      );

      // Generate comprehensive accuracy report
      const accuracyReport = await processor.getAccuracyReport();
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

      // Use throttled logging for accuracy report
      await throttledLog(
        "ACCURACY_REPORT",
        `📊📊 ONLINE STATUS ACCURACY REPORT: ${stringify(accuracyReport)}`
      );
    } catch (offlineError) {
      logger.error(`Error in offline detection: ${offlineError.message}`);
      const accuracyReport = await processor.getAccuracyReport();
      await throttledLog(
        "ACCURACY_REPORT",
        `📊📊 PARTIAL ONLINE STATUS ACCURACY REPORT: ${stringify(
          accuracyReport
        )}`
      );
    }

    logText("Online status and accuracy tracking completed successfully");
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      logText(
        "Online status processing completed with some duplicate entries (ignored)"
      );
    } else {
      logger.error(`🐛 Error in online status processing: ${stringify(error)}`);
    }
  }
}

// Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    updateOnlineStatusAndAccuracy,
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
    `✅ ${JOB_NAME} started - focused on online status updates and accuracy tracking (max ${LOG_THROTTLE_CONFIG.maxLogsPerDay} metrics/accuracy logs per day)`
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
};
