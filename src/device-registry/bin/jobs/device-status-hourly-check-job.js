const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/device-status-hourly-check-job`
);
const cron = require("node-cron");
const moment = require("moment-timezone");
const axios = require("axios");
const math = require("mathjs");
const DeviceModel = require("@models/Device");
const DeviceStatusModel = require("@models/DeviceStatus");

const TIMEZONE = moment.tz.guess();
const BATCH_SIZE = 50;
const OFFLINE_THRESHOLD_HOURS = 24;

const convertSecondsToReadableFormat = (secondsToConvert) => {
  const days = Math.floor(secondsToConvert / (24 * 3600));
  secondsToConvert %= 24 * 3600;
  const hours = Math.floor(secondsToConvert / 3600);
  secondsToConvert %= 3600;
  const minutes = Math.floor(secondsToConvert / 60);
  const seconds = Math.floor(secondsToConvert % 60);

  return `${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`;
};

const processDeviceBatch = async (devices) => {
  const metrics = {
    online: { count: 0, devices: [] },
    offline: { count: 0, devices: [] },
  };

  const BASE_API_URL =
    process.env.DATA_MANAGER_BASE_URL ||
    "https://data-manager-dot-airqo-250220.uc.r.appspot.com/api/v2/data/";

  await Promise.all(
    devices.map(async (device) => {
      try {
        if (!device.channelID) return;

        const response = await axios.get(
          `${BASE_API_URL}feeds/recent/${device.channelID}`,
          { timeout: 5000 }
        );

        if (response.status === 200) {
          const result = response.data;
          const currentDateTime = new Date();
          const lastFeedDateTime = new Date(result.created_at);

          const timeDifferenceHours =
            (currentDateTime - lastFeedDateTime) / 3600000;
          const timeDifferenceSeconds =
            (currentDateTime - lastFeedDateTime) / 1000;

          const deviceMetric = {
            device_id: device._id,
            name: device.name,
            channelID: device.channelID,
            elapsed_time: timeDifferenceHours,
            elapsed_time_readable: convertSecondsToReadableFormat(
              timeDifferenceSeconds
            ),
            latitude: device.latitude,
            longitude: device.longitude,
          };

          if (timeDifferenceHours > OFFLINE_THRESHOLD_HOURS) {
            metrics.offline.devices.push(deviceMetric);
            metrics.offline.count++;
          } else {
            metrics.online.devices.push(deviceMetric);
            metrics.online.count++;
          }
        }
      } catch (error) {
        logger.error(
          `Error processing device ${device.name}: ${error.message}`
        );
      }
    })
  );

  return metrics;
};

const deviceStatusHourlyCheck = async () => {
  try {
    const startTime = Date.now();
    logger.info("Starting hourly device status check...");

    // Get total active devices count
    const totalActiveDevices = await DeviceModel("airqo").countDocuments({
      locationID: { $ne: "" },
      isActive: true,
    });

    // Process devices in batches
    let processedCount = 0;
    const finalMetrics = {
      online: { count: 0, devices: [] },
      offline: { count: 0, devices: [] },
    };

    while (processedCount < totalActiveDevices) {
      const devices = await DeviceModel("airqo")
        .find({
          locationID: { $ne: "" },
          isActive: true,
        })
        .skip(processedCount)
        .limit(BATCH_SIZE)
        .lean();

      const batchMetrics = await processDeviceBatch(devices);

      // Merge batch metrics
      ["online", "offline"].forEach((status) => {
        finalMetrics[status].devices.push(...batchMetrics[status].devices);
        finalMetrics[status].count += batchMetrics[status].count;
      });

      processedCount += devices.length;
      logger.info(`Processed ${processedCount}/${totalActiveDevices} devices`);
    }

    // Calculate percentages
    const total = finalMetrics.online.count + finalMetrics.offline.count;
    finalMetrics.online.percentage = math.floor(
      (finalMetrics.online.count / total) * 100
    );
    finalMetrics.offline.percentage = math.floor(
      (finalMetrics.offline.count / total) * 100
    );

    // Create and save status record
    const deviceStatusRecord = new DeviceStatusModel({
      created_at: new Date(),
      total_active_device_count: total,
      metrics: finalMetrics,
      check_type: "hourly",
    });

    await deviceStatusRecord.save();

    const duration = (Date.now() - startTime) / 1000;
    logger.info(`
      Device Status Check Complete (${duration}s)
      Total Devices: ${total}
      Online Devices: ${finalMetrics.online.count} (${finalMetrics.online.percentage}%)
      Offline Devices: ${finalMetrics.offline.count} (${finalMetrics.offline.percentage}%)
    `);
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
