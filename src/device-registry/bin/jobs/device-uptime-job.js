const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/device-uptime-job`
);
const cron = require("node-cron");
const { logObject, logText } = require("@utils/shared");
const moment = require("moment-timezone");
const axios = require("axios");
const DeviceModel = require("@models/Device");
const DeviceUptimeModel = require("@models/DeviceUptime");
const NetworkUptimeModel = require("@models/NetworkUptime");

const TIMEZONE = moment.tz.guess();
const BATCH_SIZE = 50;

const JOB_NAME = "device-uptime-job";
const JOB_SCHEDULE = "0 */2 * * *"; // At minute 0 of every 2nd hour

const getDeviceRecords = async (tenant, channelId, deviceName, isActive) => {
  try {
    const response = await axios.get(`${process.env.DEVICE_READINGS_URL}`, {
      params: {
        tenant,
        channel_id: channelId,
        device_name: deviceName,
      },
      timeout: 5000, // Add timeout to prevent hanging requests
    });

    const {
      sensor_one_pm2_5,
      sensor_two_pm2_5,
      battery_voltage,
      uptime,
      downtime,
      time: createdAt,
    } = response.data;

    return {
      sensor_one_pm2_5: sensor_one_pm2_5 || 0,
      sensor_two_pm2_5: sensor_two_pm2_5 || 0,
      battery_voltage: battery_voltage || 0,
      device_name: deviceName,
      channel_id: channelId,
      uptime,
      downtime,
      created_at: new Date(createdAt),
    };
  } catch (error) {
    logger.error(
      `Error getting device records for ${deviceName}: ${error.message}`
    );
    return null;
  }
};

const processDeviceBatch = async (devices, tenant) => {
  const deviceRecords = [];
  let activeDeviceCount = 0;
  let totalUptime = 0;

  const batchPromises = devices.map(async (device) => {
    if (device.isActive) {
      activeDeviceCount++;
    }

    const channelId = device.device_number;
    const deviceName = device.name;

    if (!channelId || !deviceName) {
      logger.warn(`Missing channel ID or name for device: ${device._id}`);
      return null;
    }

    const record = await getDeviceRecords(
      tenant,
      channelId,
      deviceName,
      device.isActive
    );

    if (record && device.isActive) {
      totalUptime += record.uptime || 0;
    }

    return record;
  });

  const results = await Promise.all(batchPromises);
  const validRecords = results.filter((record) => record !== null);

  return {
    records: validRecords,
    activeCount: activeDeviceCount,
    totalUptime: totalUptime,
  };
};

const saveDeviceUptime = async (tenant) => {
  try {
    const startTime = Date.now();

    // Get total device count
    const totalDevices = await DeviceModel(tenant).countDocuments({
      network: "airqo",
      category: { $not: /^bam$/i },
    });

    let processedCount = 0;
    let totalActiveDevices = 0;
    let networkTotalUptime = 0;
    const allRecords = [];

    // Process devices in batches
    while (processedCount < totalDevices) {
      const devices = await DeviceModel(tenant)
        .find({
          network: "airqo",
          category: { $not: /^bam$/i },
        })
        .skip(processedCount)
        .limit(BATCH_SIZE)
        .lean();

      const { records, activeCount, totalUptime } = await processDeviceBatch(
        devices,
        tenant
      );

      allRecords.push(...records);
      totalActiveDevices += activeCount;
      networkTotalUptime += totalUptime;
      processedCount += devices.length;

      logText(`Processed ${processedCount}/${totalDevices} devices`);
    }

    // Calculate network uptime
    const networkUptime =
      totalActiveDevices > 0 ? networkTotalUptime / totalActiveDevices : 0;

    // Save device uptime records in bulk
    if (allRecords.length > 0) {
      await DeviceUptimeModel.insertMany(allRecords, { ordered: false });
    }

    // Save network uptime record
    const networkUptimeRecord = new NetworkUptimeModel({
      network_name: tenant,
      uptime: networkUptime,
      created_at: new Date(),
    });

    await networkUptimeRecord.save();

    const duration = (Date.now() - startTime) / 1000;
    logger.info(`
      Device uptime check completed for ${tenant} in ${duration}s
      Total Devices: ${totalDevices}
      Active Devices: ${totalActiveDevices}
      Network Uptime: ${networkUptime.toFixed(2)}%
      Records Processed: ${allRecords.length}
    `);
  } catch (error) {
    logger.error(`Error in device uptime job: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

const runDeviceUptimeCheck = async () => {
  await saveDeviceUptime("airqo");
};

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = runDeviceUptimeCheck();
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

module.exports = { saveDeviceUptime, runDeviceUptimeCheck };
