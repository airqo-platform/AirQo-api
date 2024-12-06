const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/device-status-hourly-check-job`
);
const mongoose = require("mongoose");
const cron = require("node-cron");
const moment = require("moment-timezone");
const axios = require("axios");
const math = require("mathjs");

const TIMEZONE = moment.tz.guess();

// Utility functions
const convertSecondsToReadableFormat = (secondsToConvert) => {
  const days = Math.floor(secondsToConvert / (24 * 3600));
  secondsToConvert %= 24 * 3600;
  const hours = Math.floor(secondsToConvert / 3600);
  secondsToConvert %= 3600;
  const minutes = Math.floor(secondsToConvert / 60);
  const seconds = secondsToConvert % 60;

  return `${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`;
};

const deviceStatusHourlyCheck = async () => {
  try {
    // Connect to MongoDB
    const netManagerDB = mongoose.connection.useDb("airqo_netmanager");

    // Fetch active devices
    const devices = await netManagerDB
      .collection("devices")
      .find({
        locationID: { $ne: "" },
        isActive: true,
      })
      .toArray();

    const BASE_API_URL =
      process.env.DATA_MANAGER_BASE_URL ||
      "https://data-manager-dot-airqo-250220.uc.r.appspot.com/api/v2/data/";

    let count = 0;
    let countOfOnlineDevices = 0;
    let countOfOfflineDevices = 0;
    const onlineDevices = [];
    const offlineDevices = [];

    // Process each device
    for (const channel of devices) {
      try {
        const latestDeviceStatusUrl = `${BASE_API_URL}feeds/recent/${channel.channelID}`;
        const response = await axios.get(latestDeviceStatusUrl);

        if (response.status === 200) {
          count++;
          const result = response.data;
          const currentDateTime = new Date();
          const lastFeedDateTime = new Date(result.created_at);

          const timeDifference = (currentDateTime - lastFeedDateTime) / 3600000; // Convert to hours
          const timeDifferenceInSeconds =
            (currentDateTime - lastFeedDateTime) / 1000;

          if (timeDifference > 24) {
            countOfOfflineDevices++;
            channel.time_offline = convertSecondsToReadableFormat(
              timeDifferenceInSeconds
            );
            channel.time_offline_in_hours = timeDifference;
            offlineDevices.push(channel);
          } else {
            countOfOnlineDevices++;
            onlineDevices.push(channel);
          }
        }
      } catch (deviceError) {
        logger.error(
          `Error processing device ${channel.name}: ${deviceError.message}`
        );
      }
    }

    // Calculate percentages
    const onlineDevicesPercentage = math.floor(
      (countOfOnlineDevices / count) * 100
    );
    const offlineDevicesPercentage = math.floor(
      (countOfOfflineDevices / count) * 100
    );

    // Prepare device status record
    const deviceStatusRecord = {
      online_devices_percentage: onlineDevicesPercentage,
      offline_devices_percentage: offlineDevicesPercentage,
      created_at: new Date(),
      total_active_device_count: count,
      count_of_online_devices: countOfOnlineDevices,
      count_of_offline_devices: countOfOfflineDevices,
      online_devices: onlineDevices,
      offline_devices: offlineDevices,
    };

    // Save results
    await netManagerDB
      .collection("device_status_hourly_check_results")
      .insertOne(deviceStatusRecord);

    // Log results
    logger.info(`Device Status Check Complete
      Total Devices: ${count}
      Online Devices: ${countOfOnlineDevices} (${onlineDevicesPercentage}%)
      Offline Devices: ${countOfOfflineDevices} (${offlineDevicesPercentage}%)`);
  } catch (error) {
    logger.error(`Error in device status hourly check: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

// Log that the job is starting
logger.info("Device status hourly check job is now running.....");

// Schedule the job to run every hour
cron.schedule("0 * * * *", deviceStatusHourlyCheck, {
  scheduled: true,
  timezone: TIMEZONE,
});

module.exports = { deviceStatusHourlyCheck };
