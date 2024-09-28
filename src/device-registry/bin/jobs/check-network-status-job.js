const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-network-status-job`
);
const DeviceModel = require("@models/Device");
const cron = require("node-cron");
const { logText } = require("@utils/log");

const BATCH_SIZE = 1000; // Define the size of each batch

const checkNetworkStatus = async () => {
  try {
    let totalDevices = 0;
    let offlineDevicesCount = 0;
    let pageNumber = 0;

    while (true) {
      // Fetch a batch of devices
      const devices = await DeviceModel("airqo")
        .find({}, "isOnline _id")
        .lean()
        .limit(BATCH_SIZE)
        .skip(pageNumber * BATCH_SIZE);

      if (devices.length === 0) break; // Exit loop if no more devices

      totalDevices += devices.length;

      // Count offline devices in the current batch
      offlineDevicesCount += devices.filter(
        (device) => device.isOnline === false
      ).length;

      pageNumber++; // Move to the next batch
    }

    if (totalDevices === 0) {
      logText("No devices found");
      logger.info("No devices found.");
      return;
    }

    const offlinePercentage = (offlineDevicesCount / totalDevices) * 100;

    if (offlinePercentage > 60) {
      logText(
        `⚠️💔😥 More than 60% of devices are offline: ${offlinePercentage.toFixed(
          2
        )}%`
      );

      logger.warn(
        `⚠️💔😥 More than 60% of devices are offline: ${offlinePercentage.toFixed(
          2
        )}%`
      );
    } else {
      // logText(
      //   `✅ Network status is acceptable: ${offlinePercentage.toFixed(
      //     2
      //   )}% offline`
      // );
      // logger.info(
      //   `✅ Network status is acceptable: ${offlinePercentage.toFixed(
      //     2
      //   )}% offline`
      // );
    }
  } catch (error) {
    logText(`Error checking network status: ${error.message}`);
    logger.error(`Error checking network status: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

logText("Network status job is now running.....");
const schedule = "0 */2 * * *";
cron.schedule(schedule, checkNetworkStatus, {
  scheduled: true,
  timezone: constants.TIMEZONE,
});
