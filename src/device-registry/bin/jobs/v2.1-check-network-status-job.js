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

const checkNetworkStatus = async () => {
  try {
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
      return;
    }

    const { totalDevices, offlineDevicesCount } = result[0];
    const offlinePercentage = (offlineDevicesCount / totalDevices) * 100;

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
  } catch (error) {
    logText(`🐛🐛 Error checking network status: ${error.message}`);
    logger.error(`🐛🐛 Error checking network status: ${error.message}`);
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
  }
};

// Function to get network status summary for the day
const dailyNetworkStatusSummary = async () => {
  try {
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
  } catch (error) {
    logger.error(`Error generating daily summary: ${error.message}`);
  }
};

logText("Network status job is now running.....");

// Main check runs every 2 hours
const mainSchedule = "30 */2 * * *"; // At minute 30 of every 2nd hour
cron.schedule(mainSchedule, checkNetworkStatus, {
  scheduled: true,
  timezone: TIMEZONE,
});

// Daily summary runs at 8 AM every day
const summarySchedule = "0 8 * * *"; // At 8:00 AM every day
cron.schedule(summarySchedule, dailyNetworkStatusSummary, {
  scheduled: true,
  timezone: TIMEZONE,
});

// Run initial check on startup
// checkNetworkStatus();
