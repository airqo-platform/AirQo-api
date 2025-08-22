const constants = require("@config/constants");
const DeviceModel = require("@models/Device");
const NetworkStatusAlertModel = require("@models/NetworkStatusAlert");
const networkStatusUtil = require("@utils/network-status.util");
const cron = require("node-cron");
const { logObject, logText } = require("@utils/shared");
const moment = require("moment-timezone");

const TIMEZONE = moment.tz.guess();
const UPTIME_THRESHOLD = 35;
const CRITICAL_THRESHOLD = 50; // New threshold for critical status

// Job identification - SEPARATE NAMES FOR EACH JOB
const MAIN_JOB_NAME = "network-status-check-job";
const SUMMARY_JOB_NAME = "network-status-summary-job";
const MAIN_JOB_SCHEDULE = "30 */2 * * *"; // At minute 30 of every 2nd hour
const SUMMARY_JOB_SCHEDULE = "0 8 * * *"; // At 8:00 AM every day

let isMainJobRunning = false;
let isSummaryJobRunning = false;
let currentMainJobPromise = null;
let currentSummaryJobPromise = null;

const checkNetworkStatus = async () => {
  // Prevent overlapping executions
  if (isMainJobRunning) {
    global.alertLogger.warn(
      `${MAIN_JOB_NAME} is already running, skipping this execution`
    );

    // Log detailed info for troubleshooting (no Slack)
    global.appLogger.warn(`Job overlap prevented:`, {
      job: MAIN_JOB_NAME,
      action: "skipped_execution",
      timestamp: new Date().toISOString(),
    });

    return;
  }

  isMainJobRunning = true;
  const startTime = Date.now();

  try {
    // Check if job should stop (for graceful shutdown)
    if (global.isShuttingDown) {
      logText(`${MAIN_JOB_NAME} stopping due to application shutdown`);
      global.appLogger.info(
        `${MAIN_JOB_NAME} stopping due to application shutdown`
      );
      return;
    }

    const result = await DeviceModel("airqo").aggregate([
      {
        $match: {
          status: "deployed", // Only consider deployed devices
        },
      },
      {
        $group: {
          _id: null,
          totalDevices: { $sum: 1 },
          offlineDevicesCount: {
            $sum: {
              $cond: [{ $eq: ["$isOnline", false] }, 1, 0],
            },
          },
        },
      },
    ]);

    if (result.length === 0 || result[0].totalDevices === 0) {
      logText("No deployed devices found");

      // This is an alert-worthy situation - no devices deployed
      global.alertLogger.warn("⚠️ No deployed devices found");

      // Detailed logging for operations team
      global.appLogger.warn(`No deployed devices found:`, {
        aggregationResult: result,
        timestamp: new Date().toISOString(),
        job: MAIN_JOB_NAME,
      });

      // Still create an alert even when no devices are found
      const alertData = {
        checked_at: new Date(),
        total_deployed_devices: 0,
        offline_devices_count: 0,
        offline_percentage: 0,
        status: "OK",
        message: "No deployed devices found",
        threshold_exceeded: false,
        threshold_value: UPTIME_THRESHOLD,
      };

      try {
        await networkStatusUtil.createAlert({ alertData, tenant: "airqo" });
        global.appLogger.info(`Alert created for no devices scenario`);
      } catch (alertError) {
        global.criticalLogger.error(
          `💥 Failed to create no-devices alert: ${alertError.message}`
        );
      }

      return;
    }

    const { totalDevices, offlineDevicesCount } = result[0];
    const offlinePercentage = (offlineDevicesCount / totalDevices) * 100;

    // Check again if we should stop (long-running operations)
    if (global.isShuttingDown) {
      logText(`${MAIN_JOB_NAME} stopping due to application shutdown`);
      global.appLogger.info(
        `${MAIN_JOB_NAME} stopping due to application shutdown`
      );
      return;
    }

    // Determine status based on offline percentage
    let status = "OK";
    let message = "";
    let thresholdExceeded = false;

    if (offlinePercentage >= CRITICAL_THRESHOLD) {
      status = "CRITICAL";
      message = `🚨 CRITICAL: ${offlinePercentage.toFixed(
        2
      )}% of deployed devices are offline (${offlineDevicesCount}/${totalDevices})`;
      thresholdExceeded = true;
    } else if (offlinePercentage > UPTIME_THRESHOLD) {
      status = "WARNING";
      message = `🔴 More than ${UPTIME_THRESHOLD}% of deployed devices are offline: ${offlinePercentage.toFixed(
        2
      )}% (${offlineDevicesCount}/${totalDevices})`;
      thresholdExceeded = true;
    } else {
      status = "OK";
      message = `✅ Network status is acceptable for deployed devices: ${offlinePercentage.toFixed(
        2
      )}% offline (${offlineDevicesCount}/${totalDevices})`;
    }

    // Log to console as before
    logText(message);

    // Use appropriate logger based on severity
    if (status === "CRITICAL") {
      // Critical network issues go to Slack immediately
      global.criticalLogger.error(message);
    } else if (status === "WARNING") {
      // Warning alerts go to Slack with deduplication
      global.alertLogger.warn(message);
    } else {
      // OK status goes to Slack for monitoring (deduplicated)
      global.alertLogger.info(message);
    }

    // Detailed operational logging (no Slack)
    global.appLogger.info(`Network status check completed:`, {
      status,
      totalDevices,
      offlineDevicesCount,
      offlinePercentage: parseFloat(offlinePercentage.toFixed(2)),
      thresholdExceeded,
      thresholds: {
        warning: UPTIME_THRESHOLD,
        critical: CRITICAL_THRESHOLD,
      },
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      job: MAIN_JOB_NAME,
    });

    // Create alert record in database
    const alertData = {
      checked_at: new Date(),
      total_deployed_devices: totalDevices,
      offline_devices_count: offlineDevicesCount,
      offline_percentage: parseFloat(offlinePercentage.toFixed(2)),
      status,
      message,
      threshold_exceeded: thresholdExceeded,
      threshold_value: UPTIME_THRESHOLD,
    };

    const alertResult = await networkStatusUtil.createAlert({
      alertData,
      tenant: "airqo",
    });

    if (alertResult && alertResult.success) {
      logText("Network status alert saved successfully");
      global.appLogger.info(`Network status alert saved:`, {
        alertId: alertResult.data?._id,
        status,
        timestamp: new Date().toISOString(),
        job: MAIN_JOB_NAME,
      });
    } else {
      logText("Failed to save network status alert");

      // Alert creation failure is critical
      global.criticalLogger.error(
        `💥 Failed to save network status alert: ${JSON.stringify(alertResult)}`
      );

      global.appLogger.error(`Alert creation failed:`, {
        alertData,
        alertResult,
        timestamp: new Date().toISOString(),
        job: MAIN_JOB_NAME,
      });
    }
  } catch (error) {
    logText(`🐛🐛 Error checking network status: ${error.message}`);

    // Critical system error
    global.criticalLogger.error(
      `💥 ${MAIN_JOB_NAME} Error checking network status: ${error.message}`
    );
    global.criticalLogger.error(`Stack trace: ${error.stack}`);

    // Detailed error logging
    global.appLogger.error(`${MAIN_JOB_NAME} execution failed:`, {
      error: error.message,
      stack: error.stack,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      job: MAIN_JOB_NAME,
    });

    // Still try to save an error alert
    try {
      const errorAlertData = {
        checked_at: new Date(),
        total_deployed_devices: 0,
        offline_devices_count: 0,
        offline_percentage: 0,
        status: "CRITICAL",
        message: `Error checking network status: ${error.message}`,
        threshold_exceeded: true,
        threshold_value: UPTIME_THRESHOLD,
      };

      await networkStatusUtil.createAlert({
        alertData: errorAlertData,
        tenant: "airqo",
      });

      global.appLogger.info(`Error alert created for failed execution`);
    } catch (alertError) {
      global.criticalLogger.error(
        `💥 Failed to save error alert: ${alertError.message}`
      );

      global.appLogger.error(`Error alert creation failed:`, {
        originalError: error.message,
        alertError: alertError.message,
        timestamp: new Date().toISOString(),
        job: MAIN_JOB_NAME,
      });
    }
  } finally {
    isMainJobRunning = false;
    currentMainJobPromise = null;

    global.appLogger.info(`${MAIN_JOB_NAME} execution completed:`, {
      totalExecutionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      job: MAIN_JOB_NAME,
    });
  }
};

// Function to get network status summary for the day
const dailyNetworkStatusSummary = async () => {
  // Prevent overlapping executions
  if (isSummaryJobRunning) {
    global.alertLogger.warn(
      `${SUMMARY_JOB_NAME} is already running, skipping this execution`
    );

    global.appLogger.warn(`Summary job overlap prevented:`, {
      job: SUMMARY_JOB_NAME,
      action: "skipped_execution",
      timestamp: new Date().toISOString(),
    });

    return;
  }

  isSummaryJobRunning = true;
  const startTime = Date.now();

  try {
    // Check if job should stop (for graceful shutdown)
    if (global.isShuttingDown) {
      logText(`${SUMMARY_JOB_NAME} stopping due to application shutdown`);
      global.appLogger.info(
        `${SUMMARY_JOB_NAME} stopping due to application shutdown`
      );
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filter = {
      checked_at: {
        $gte: yesterday,
        $lt: today,
      },
    };

    const statistics = await NetworkStatusAlertModel("airqo").getStatistics({
      filter,
    });

    if (statistics.success && statistics.data.length > 0) {
      const stats = statistics.data[0];
      const summaryMessage = `📊 Daily Network Status Summary (${moment(
        yesterday
      ).format("YYYY-MM-DD")})
Total Alerts: ${stats.totalAlerts}
Average Offline %: ${stats.avgOfflinePercentage.toFixed(2)}%
Max Offline %: ${stats.maxOfflinePercentage.toFixed(2)}%
Min Offline %: ${stats.minOfflinePercentage.toFixed(2)}%
Warning Alerts: ${stats.warningCount}
Critical Alerts: ${stats.criticalCount}`;

      logText(summaryMessage);

      // Daily summaries are important monitoring info - send to Slack
      global.alertLogger.info(summaryMessage);

      // Detailed statistics logging
      global.appLogger.info(`Daily network status summary generated:`, {
        date: moment(yesterday).format("YYYY-MM-DD"),
        stats: {
          totalAlerts: stats.totalAlerts,
          avgOfflinePercentage: stats.avgOfflinePercentage,
          maxOfflinePercentage: stats.maxOfflinePercentage,
          minOfflinePercentage: stats.minOfflinePercentage,
          warningCount: stats.warningCount,
          criticalCount: stats.criticalCount,
        },
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        job: SUMMARY_JOB_NAME,
      });

      // Alert if we had critical issues yesterday
      if (stats.criticalCount > 0) {
        global.alertLogger.warn(
          `⚠️ ${stats.criticalCount} critical network alerts occurred yesterday`
        );
      }
    } else {
      const noDataMessage = `📊 No network status data available for ${moment(
        yesterday
      ).format("YYYY-MM-DD")}`;
      logText(noDataMessage);

      // No data could indicate a problem
      global.alertLogger.warn(noDataMessage);

      global.appLogger.warn(`No summary data available:`, {
        date: moment(yesterday).format("YYYY-MM-DD"),
        statisticsResult: statistics,
        filter,
        timestamp: new Date().toISOString(),
        job: SUMMARY_JOB_NAME,
      });
    }
  } catch (error) {
    // Critical error in summary generation
    global.criticalLogger.error(
      `💥 ${SUMMARY_JOB_NAME} Error generating daily summary: ${error.message}`
    );
    global.criticalLogger.error(`Stack trace: ${error.stack}`);

    global.appLogger.error(`${SUMMARY_JOB_NAME} execution failed:`, {
      error: error.message,
      stack: error.stack,
      executionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      job: SUMMARY_JOB_NAME,
    });
  } finally {
    isSummaryJobRunning = false;
    currentSummaryJobPromise = null;

    global.appLogger.info(`${SUMMARY_JOB_NAME} execution completed:`, {
      totalExecutionTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      job: SUMMARY_JOB_NAME,
    });
  }
};

// Wrapper functions to handle promises for graceful shutdown
const mainJobWrapper = async () => {
  currentMainJobPromise = checkNetworkStatus();
  await currentMainJobPromise;
};

const summaryJobWrapper = async () => {
  currentSummaryJobPromise = dailyNetworkStatusSummary();
  await currentSummaryJobPromise;
};

// Enhanced startup logging
const jobStartupMessage = `Network status jobs (${MAIN_JOB_NAME}, ${SUMMARY_JOB_NAME}) initializing...`;
logText(jobStartupMessage);
global.appLogger.info(jobStartupMessage);

// Create and start BOTH cron jobs
const startNetworkStatusJobs = () => {
  try {
    // CREATE FIRST JOB - Main network status check
    const mainJobInstance = cron.schedule(MAIN_JOB_SCHEDULE, mainJobWrapper, {
      scheduled: true,
      timezone: TIMEZONE,
    });

    // CREATE SECOND JOB - Daily summary
    const summaryJobInstance = cron.schedule(
      SUMMARY_JOB_SCHEDULE,
      summaryJobWrapper,
      {
        scheduled: true,
        timezone: TIMEZONE,
      }
    );

    // Initialize global cronJobs if it doesn't exist
    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    // REGISTER FIRST JOB
    global.cronJobs[MAIN_JOB_NAME] = {
      job: mainJobInstance,
      name: MAIN_JOB_NAME,
      schedule: MAIN_JOB_SCHEDULE,
      startedAt: new Date().toISOString(),
      stop: async () => {
        try {
          logText(`🛑 Stopping ${MAIN_JOB_NAME}...`);
          global.appLogger.info(`Stopping ${MAIN_JOB_NAME}...`);

          // Stop the cron schedule
          mainJobInstance.stop();
          logText(`📅 ${MAIN_JOB_NAME} schedule stopped`);

          // Wait for current execution to finish if running
          if (currentMainJobPromise) {
            logText(
              `⏳ Waiting for current ${MAIN_JOB_NAME} execution to finish...`
            );
            global.appLogger.info(
              `Waiting for current ${MAIN_JOB_NAME} execution to finish...`
            );

            await currentMainJobPromise;
            logText(`✅ Current ${MAIN_JOB_NAME} execution completed`);
          }

          // Destroy the job
          if (typeof mainJobInstance.destroy === "function") {
            mainJobInstance.destroy();
            logText(`💥 ${MAIN_JOB_NAME} destroyed successfully`);
          }

          // Remove from global registry
          delete global.cronJobs[MAIN_JOB_NAME];

          const stopMessage = `✅ ${MAIN_JOB_NAME} stopped successfully`;
          console.log(stopMessage);
          global.appLogger.info(stopMessage);
        } catch (error) {
          const errorMessage = `❌ Error stopping ${MAIN_JOB_NAME}: ${error.message}`;
          console.error(errorMessage);
          global.criticalLogger.error(errorMessage);
        }
      },
    };

    // REGISTER SECOND JOB
    global.cronJobs[SUMMARY_JOB_NAME] = {
      job: summaryJobInstance,
      name: SUMMARY_JOB_NAME,
      schedule: SUMMARY_JOB_SCHEDULE,
      startedAt: new Date().toISOString(),
      stop: async () => {
        try {
          logText(`🛑 Stopping ${SUMMARY_JOB_NAME}...`);
          global.appLogger.info(`Stopping ${SUMMARY_JOB_NAME}...`);

          // Stop the cron schedule
          summaryJobInstance.stop();
          logText(`📅 ${SUMMARY_JOB_NAME} schedule stopped`);

          // Wait for current execution to finish if running
          if (currentSummaryJobPromise) {
            logText(
              `⏳ Waiting for current ${SUMMARY_JOB_NAME} execution to finish...`
            );
            global.appLogger.info(
              `Waiting for current ${SUMMARY_JOB_NAME} execution to finish...`
            );

            await currentSummaryJobPromise;
            logText(`✅ Current ${SUMMARY_JOB_NAME} execution completed`);
          }

          // Destroy the job
          if (typeof summaryJobInstance.destroy === "function") {
            summaryJobInstance.destroy();
            logText(`💥 ${SUMMARY_JOB_NAME} destroyed successfully`);
          }

          // Remove from global registry
          delete global.cronJobs[SUMMARY_JOB_NAME];

          const stopMessage = `✅ ${SUMMARY_JOB_NAME} stopped successfully`;
          console.log(stopMessage);
          global.appLogger.info(stopMessage);
        } catch (error) {
          const errorMessage = `❌ Error stopping ${SUMMARY_JOB_NAME}: ${error.message}`;
          console.error(errorMessage);
          global.criticalLogger.error(errorMessage);
        }
      },
    };

    const mainStartMessage = `✅ ${MAIN_JOB_NAME} registered and started (${MAIN_JOB_SCHEDULE})`;
    const summaryStartMessage = `✅ ${SUMMARY_JOB_NAME} registered and started (${SUMMARY_JOB_SCHEDULE})`;

    logText(mainStartMessage);
    logText(summaryStartMessage);
    logText("Network status jobs are now running.....");

    global.appLogger.info(mainStartMessage);
    global.appLogger.info(summaryStartMessage);

    return {
      mainJob: global.cronJobs[MAIN_JOB_NAME],
      summaryJob: global.cronJobs[SUMMARY_JOB_NAME],
    };
  } catch (error) {
    const startupError = `❌ Failed to start network status jobs: ${error.message}`;
    console.error(startupError);
    global.criticalLogger.error(startupError);
    global.criticalLogger.error(`Startup error stack: ${error.stack}`);
    throw error;
  }
};

// Graceful shutdown handlers for these specific jobs
const handleShutdown = async (signal) => {
  logText(`📨 Network status jobs received ${signal} signal`);
  global.appLogger.info(`Network status jobs received ${signal} signal`);

  // Stop both jobs
  if (global.cronJobs && global.cronJobs[MAIN_JOB_NAME]) {
    await global.cronJobs[MAIN_JOB_NAME].stop();
  }

  if (global.cronJobs && global.cronJobs[SUMMARY_JOB_NAME]) {
    await global.cronJobs[SUMMARY_JOB_NAME].stop();
  }

  logText(`👋 Network status jobs shutdown complete`);
  global.appLogger.info(`👋 Network status jobs shutdown complete`);
};

// Register shutdown handlers if not already done globally
if (!global.jobShutdownHandlersRegistered) {
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  global.jobShutdownHandlersRegistered = true;
}

// Handle uncaught exceptions in this job
process.on("uncaughtException", (error) => {
  global.criticalLogger.error(
    `💥 Uncaught Exception in network status jobs: ${error.message}`
  );
  global.criticalLogger.error(`Stack: ${error.stack}`);
});

process.on("unhandledRejection", (reason, promise) => {
  global.criticalLogger.error(
    `🚫 Unhandled Rejection in network status jobs at: ${promise}, reason: ${reason}`
  );
});

// Start both jobs
try {
  startNetworkStatusJobs();
  const completionMessage = `🎉 Network status jobs initialization complete`;
  logText(completionMessage);
  global.appLogger.info(completionMessage);
} catch (error) {
  const failureMessage = `💥 Failed to initialize network status jobs: ${error.message}`;
  console.error(failureMessage);
  global.criticalLogger.error(failureMessage);
  process.exit(1);
}

// Export for testing or manual control
module.exports = {
  MAIN_JOB_NAME,
  SUMMARY_JOB_NAME,
  MAIN_JOB_SCHEDULE,
  SUMMARY_JOB_SCHEDULE,
  startNetworkStatusJobs,
  checkNetworkStatus,
  dailyNetworkStatusSummary,
  stopJobs: async () => {
    if (global.cronJobs && global.cronJobs[MAIN_JOB_NAME]) {
      await global.cronJobs[MAIN_JOB_NAME].stop();
    }
    if (global.cronJobs && global.cronJobs[SUMMARY_JOB_NAME]) {
      await global.cronJobs[SUMMARY_JOB_NAME].stop();
    }
  },
};
