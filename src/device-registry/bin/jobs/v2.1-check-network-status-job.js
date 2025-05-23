const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/v2-check-network-status-job`
);
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
    logger.warn(`${MAIN_JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isMainJobRunning = true;
  logger.info(`🚀 Starting ${MAIN_JOB_NAME} execution`);

  try {
    // Check if job should stop (for graceful shutdown)
    if (global.isShuttingDown) {
      logger.info(`${MAIN_JOB_NAME} stopping due to application shutdown`);
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
      logger.info("No deployed devices found.");

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

      await networkStatusUtil.createAlert({ alertData, tenant: "airqo" });
      logger.info(`✅ ${MAIN_JOB_NAME} completed successfully`);
      return;
    }

    const { totalDevices, offlineDevicesCount } = result[0];
    const offlinePercentage = (offlineDevicesCount / totalDevices) * 100;

    // Check again if we should stop (long-running operations)
    if (global.isShuttingDown) {
      logger.info(`${MAIN_JOB_NAME} stopping due to application shutdown`);
      return;
    }

    // Determine status based on offline percentage
    let status = "OK";
    let message = "";
    let thresholdExceeded = false;

    if (offlinePercentage >= CRITICAL_THRESHOLD) {
      status = "CRITICAL";
      message = `🚨🆘 CRITICAL: ${offlinePercentage.toFixed(
        2
      )}% of deployed devices are offline (${offlineDevicesCount}/${totalDevices})`;
      thresholdExceeded = true;
    } else if (offlinePercentage > UPTIME_THRESHOLD) {
      status = "WARNING";
      message = `⚠️💔😥 More than ${UPTIME_THRESHOLD}% of deployed devices are offline: ${offlinePercentage.toFixed(
        2
      )}% (${offlineDevicesCount}/${totalDevices})`;
      thresholdExceeded = true;
    } else {
      status = "OK";
      message = `✅ Network status is acceptable for deployed devices: ${offlinePercentage.toFixed(
        2
      )}% offline (${offlineDevicesCount}/${totalDevices})`;
    }

    // Log to Slack/console as before
    logText(message);
    if (status === "CRITICAL") {
      logger.error(message);
    } else if (status === "WARNING") {
      logger.warn(message);
    } else {
      logger.info(message);
    }

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
    } else {
      logText("Failed to save network status alert");
      logger.error("Failed to save network status alert", alertResult);
    }

    logger.info(`✅ ${MAIN_JOB_NAME} completed successfully`);
  } catch (error) {
    logText(`🐛🐛 Error checking network status: ${error.message}`);
    logger.error(
      `🐛🐛 ${MAIN_JOB_NAME} Error checking network status: ${error.message}`
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);

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
    } catch (alertError) {
      logger.error(`Failed to save error alert: ${alertError.message}`);
    }
  } finally {
    isMainJobRunning = false;
    currentMainJobPromise = null;
    logger.info(`🏁 ${MAIN_JOB_NAME} execution finished`);
  }
};

// Function to get network status summary for the day
const dailyNetworkStatusSummary = async () => {
  // Prevent overlapping executions
  if (isSummaryJobRunning) {
    logger.warn(
      `${SUMMARY_JOB_NAME} is already running, skipping this execution`
    );
    return;
  }

  isSummaryJobRunning = true;
  logger.info(`🚀 Starting ${SUMMARY_JOB_NAME} execution`);

  try {
    // Check if job should stop (for graceful shutdown)
    if (global.isShuttingDown) {
      logger.info(`${SUMMARY_JOB_NAME} stopping due to application shutdown`);
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
      const summaryMessage = `
📊 Daily Network Status Summary (${moment(yesterday).format("YYYY-MM-DD")})
Total Alerts: ${stats.totalAlerts}
Average Offline %: ${stats.avgOfflinePercentage.toFixed(2)}%
Max Offline %: ${stats.maxOfflinePercentage.toFixed(2)}%
Min Offline %: ${stats.minOfflinePercentage.toFixed(2)}%
Warning Alerts: ${stats.warningCount}
Critical Alerts: ${stats.criticalCount}
      `;

      logText(summaryMessage);
      logger.info(summaryMessage);
    }

    logger.info(`✅ ${SUMMARY_JOB_NAME} completed successfully`);
  } catch (error) {
    logger.error(
      `🐛🐛 ${SUMMARY_JOB_NAME} Error generating daily summary: ${error.message}`
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  } finally {
    isSummaryJobRunning = false;
    currentSummaryJobPromise = null;
    logger.info(`🏁 ${SUMMARY_JOB_NAME} execution finished`);
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

// Create and start BOTH cron jobs
const startNetworkStatusJobs = () => {
  try {
    logger.info(`🕐 Starting network status jobs...`);

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
      stop: async () => {
        logger.info(`🛑 Stopping ${MAIN_JOB_NAME}...`);

        try {
          // Stop the cron schedule
          mainJobInstance.stop();
          logger.info(`📅 ${MAIN_JOB_NAME} schedule stopped`);

          // Wait for current execution to finish if running
          if (currentMainJobPromise) {
            logger.info(
              `⏳ Waiting for current ${MAIN_JOB_NAME} execution to finish...`
            );
            await currentMainJobPromise;
            logger.info(`✅ Current ${MAIN_JOB_NAME} execution completed`);
          }

          // Destroy the job
          mainJobInstance.destroy();
          logger.info(`💥 ${MAIN_JOB_NAME} destroyed successfully`);

          // Remove from global registry
          delete global.cronJobs[MAIN_JOB_NAME];
        } catch (error) {
          logger.error(`❌ Error stopping ${MAIN_JOB_NAME}: ${error.message}`);
        }
      },
    };

    // REGISTER SECOND JOB
    global.cronJobs[SUMMARY_JOB_NAME] = {
      job: summaryJobInstance,
      name: SUMMARY_JOB_NAME,
      schedule: SUMMARY_JOB_SCHEDULE,
      stop: async () => {
        logger.info(`🛑 Stopping ${SUMMARY_JOB_NAME}...`);

        try {
          // Stop the cron schedule
          summaryJobInstance.stop();
          logger.info(`📅 ${SUMMARY_JOB_NAME} schedule stopped`);

          // Wait for current execution to finish if running
          if (currentSummaryJobPromise) {
            logger.info(
              `⏳ Waiting for current ${SUMMARY_JOB_NAME} execution to finish...`
            );
            await currentSummaryJobPromise;
            logger.info(`✅ Current ${SUMMARY_JOB_NAME} execution completed`);
          }

          // Destroy the job
          summaryJobInstance.destroy();
          logger.info(`💥 ${SUMMARY_JOB_NAME} destroyed successfully`);

          // Remove from global registry
          delete global.cronJobs[SUMMARY_JOB_NAME];
        } catch (error) {
          logger.error(
            `❌ Error stopping ${SUMMARY_JOB_NAME}: ${error.message}`
          );
        }
      },
    };

    logger.info(
      `✅ ${MAIN_JOB_NAME} registered and started (${MAIN_JOB_SCHEDULE})`
    );
    logger.info(
      `✅ ${SUMMARY_JOB_NAME} registered and started (${SUMMARY_JOB_SCHEDULE})`
    );
    logText("Network status job is now running.....");

    return {
      mainJob: global.cronJobs[MAIN_JOB_NAME],
      summaryJob: global.cronJobs[SUMMARY_JOB_NAME],
    };
  } catch (error) {
    logger.error(`❌ Failed to start network status jobs: ${error.message}`);
    throw error;
  }
};

// Graceful shutdown handlers for these specific jobs
const handleShutdown = async (signal) => {
  logger.info(`📨 Network status jobs received ${signal} signal`);

  // Stop both jobs
  if (global.cronJobs && global.cronJobs[MAIN_JOB_NAME]) {
    await global.cronJobs[MAIN_JOB_NAME].stop();
  }

  if (global.cronJobs && global.cronJobs[SUMMARY_JOB_NAME]) {
    await global.cronJobs[SUMMARY_JOB_NAME].stop();
  }

  logger.info(`👋 Network status jobs shutdown complete`);
};

// Register shutdown handlers if not already done globally
if (!global.jobShutdownHandlersRegistered) {
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  global.jobShutdownHandlersRegistered = true;
}

// Handle uncaught exceptions in this job
process.on("uncaughtException", (error) => {
  logger.error(
    `💥 Uncaught Exception in network status jobs: ${error.message}`
  );
  logger.error(`Stack: ${error.stack}`);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    `🚫 Unhandled Rejection in network status jobs at:`,
    promise,
    "reason:",
    reason
  );
});

// Start both jobs
try {
  startNetworkStatusJobs();
  logger.info(`🎉 Network status jobs initialization complete`);
} catch (error) {
  logger.error(`💥 Failed to initialize network status jobs: ${error.message}`);
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
