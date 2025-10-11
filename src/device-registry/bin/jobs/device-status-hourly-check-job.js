const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/device-status-hourly-check-job`
);
const cron = require("node-cron");
const moment = require("moment-timezone");
const math = require("mathjs");
const DeviceModel = require("@models/Device");
const DeviceStatusModel = require("@models/DeviceStatus");
const createFeedUtil = require("@utils/create-feed");
const { logObject, logText } = require("@utils/shared");

const TIMEZONE = moment.tz.guess();
const BATCH_SIZE = 50;
const OFFLINE_THRESHOLD_HOURS = 24;

const JOB_NAME = "device-status-hourly-check-job";
const JOB_SCHEDULE = "0 * * * *"; // At minute 0 of every hour

const convertSecondsToReadableFormat = (secondsToConvert) => {
  const days = Math.floor(secondsToConvert / (24 * 3600));
  secondsToConvert %= 24 * 3600;
  const hours = Math.floor(secondsToConvert / 3600);
  secondsToConvert %= 3600;
  const minutes = Math.floor(secondsToConvert / 60);
  const seconds = Math.floor(secondsToConvert % 60);

  return `${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`;
};

const getDeviceLastFeed = async (channelID) => {
  try {
    const api_key = await createFeedUtil.getAPIKey(channelID);
    const request = { channel: channelID, api_key };
    const thingspeakData = await createFeedUtil.fetchThingspeakData(request);
    const { status, data } = createFeedUtil.handleThingspeakResponse(
      thingspeakData
    );

    if (status === 200) {
      return data;
    }
    return null;
  } catch (error) {
    logger.error(
      `Error getting last feed for channel ${channelID}: ${error.message}`
    );
    return null;
  }
};

const processDeviceBatch = async (devices) => {
  const metrics = {
    online: { count: 0, devices: [] },
    offline: { count: 0, devices: [] },
  };

  await Promise.all(
    devices.map(async (device) => {
      try {
        if (!device.channelID) return;

        const lastFeed = await getDeviceLastFeed(device.channelID);

        if (lastFeed) {
          const currentDateTime = new Date();
          const lastFeedDateTime = new Date(lastFeed.created_at);

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
    logText("Starting hourly device status check...");

    const totalActiveDevices = await DeviceModel("airqo").countDocuments({
      locationID: { $ne: "" },
      isActive: true,
    });

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

      ["online", "offline"].forEach((status) => {
        finalMetrics[status].devices.push(...batchMetrics[status].devices);
        finalMetrics[status].count += batchMetrics[status].count;
      });

      processedCount += devices.length;
      logText(`Processed ${processedCount}/${totalActiveDevices} devices`);
    }

    const total = finalMetrics.online.count + finalMetrics.offline.count;
    finalMetrics.online.percentage = math.floor(
      (finalMetrics.online.count / total) * 100
    );
    finalMetrics.offline.percentage = math.floor(
      (finalMetrics.offline.count / total) * 100
    );

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

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution.`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = deviceStatusHourlyCheck();
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
    scheduled: true,
    timezone: TIMEZONE,
  });

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      logText(`🛑 Stopping ${JOB_NAME}...`);
      cronJobInstance.stop();
      logText(`📅 ${JOB_NAME} schedule stopped.`);
      if (currentJobPromise) {
        await currentJobPromise;
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

// Start the job
startJob();

module.exports = { deviceStatusHourlyCheck };
