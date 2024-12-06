const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/device-uptime-job`
);
const mongoose = require("mongoose");
const cron = require("node-cron");
const moment = require("moment-timezone");
const axios = require("axios");

const TIMEZONE = moment.tz.guess();

const getDeviceRecords = async (tenant, channelId, deviceName, isActive) => {
  try {
    // Assuming you have a similar endpoint to fetch sensor readings
    const response = await axios.get(`${process.env.DEVICE_READINGS_URL}`, {
      params: {
        tenant,
        channel_id: channelId,
        device_name: deviceName,
      },
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
      is_active: isActive,
    };
  } catch (error) {
    logger.error(
      `Error getting device records for ${deviceName}: ${error.message}`
    );
    return null;
  }
};

const saveDeviceUptime = async (tenant) => {
  try {
    // Connect to device registry database
    const deviceRegistryDB = mongoose.connection.useDb(
      `${tenant}_device_registry`
    );
    const deviceMonitoringDB = mongoose.connection.useDb(
      `${tenant}_device_monitoring`
    );

    // Fetch all devices
    const devices = await deviceRegistryDB
      .collection("devices")
      .find({})
      .toArray();

    const records = [];
    let activeDeviceCount = 0;

    // Process devices concurrently
    const devicePromises = devices
      .filter(
        (device) =>
          device.network === "airqo" &&
          String(device.category).toLowerCase() !== "bam"
      )
      .map(async (device) => {
        // Count active devices
        if (device.isActive) {
          activeDeviceCount++;
        }

        const channelId = device.device_number;
        const deviceName = device.name;

        // Skip devices without channel ID or name
        if (!channelId || !deviceName) {
          logger.warn(`Device could not be processed: ${deviceName}`);
          return null;
        }

        // Get device records
        return getDeviceRecords(tenant, channelId, deviceName, device.isActive);
      });

    // Wait for all device processing to complete
    const processedRecords = await Promise.all(devicePromises);

    // Filter out null records
    const validRecords = processedRecords.filter((record) => record !== null);

    // Calculate network uptime
    let networkUptime = 0.0;
    if (validRecords.length > 0) {
      networkUptime =
        validRecords
          .filter((record) => record.is_active)
          .reduce((sum, record) => sum + (record.uptime || 0), 0) /
        activeDeviceCount;
    }

    // Save device uptime records
    if (validRecords.length > 0) {
      await deviceMonitoringDB
        .collection("device_uptime")
        .insertMany(validRecords);
    }

    // Prepare and save network uptime record
    const networkUptimeRecord = {
      network_name: tenant,
      uptime: networkUptime,
      created_at: new Date(),
    };

    await deviceMonitoringDB
      .collection("network_uptime")
      .insertOne(networkUptimeRecord);

    logger.info(
      `Device uptime job completed for ${tenant}. Network Uptime: ${networkUptime}`
    );
  } catch (error) {
    logger.error(`Error in device uptime job: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

// Run the job for 'airqo' tenant
const runDeviceUptimeCheck = async () => {
  await saveDeviceUptime("airqo");
};

// Log that the job is starting
logger.info("Device uptime check job is now running.....");

// Schedule the job (every 2 hours)
cron.schedule("0 */2 * * *", runDeviceUptimeCheck, {
  scheduled: true,
  timezone: TIMEZONE,
});

module.exports = { saveDeviceUptime, runDeviceUptimeCheck };
