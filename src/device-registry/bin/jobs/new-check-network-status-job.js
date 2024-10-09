const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/new-check-network-status-job`
);
const DeviceModel = require("@models/Device");
const cron = require("node-cron");
const { logText } = require("@utils/log");
const moment = require("moment-timezone");
const TIMEZONE = moment.tz.guess();
const UPTIME_THRESHOLD = 50;

const checkNetworkStatus = async () => {
  try {
    const result = await DeviceModel("airqo").aggregate([
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
      logText("No devices found");
      logger.info("No devices found.");
      return;
    }

    const { totalDevices, offlineDevicesCount } = result[0];
    const offlinePercentage = (offlineDevicesCount / totalDevices) * 100;

    if (offlinePercentage > UPTIME_THRESHOLD) {
      logText(
        `⚠️💔😥 More than ${UPTIME_THRESHOLD}% of devices are offline: ${offlinePercentage.toFixed(
          2
        )}%`
      );
      logger.warn(
        `⚠️💔😥 More than ${UPTIME_THRESHOLD}% of devices are offline: ${offlinePercentage.toFixed(
          2
        )}%`
      );
    } else {
      logText(
        `✅ Network status is acceptable: ${offlinePercentage.toFixed(
          2
        )}% offline`
      );
      logger.info(
        `✅ Network status is acceptable: ${offlinePercentage.toFixed(
          2
        )}% offline`
      );
    }
  } catch (error) {
    logText(`Error checking network status: ${error.message}`);
    logger.error(`Error checking network status: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

logText("Network status job is now running.....");
const schedule = "30 */2 * * *"; // At minute 30 of every 2nd hour
cron.schedule(schedule, checkNetworkStatus, {
  scheduled: true,
  timezone: TIMEZONE,
});
