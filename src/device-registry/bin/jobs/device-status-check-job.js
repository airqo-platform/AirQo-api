const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/device-status-check-job`
);
const mongoose = require("mongoose");
const cron = require("node-cron");
const moment = require("moment-timezone");
const axios = require("axios");

const TIMEZONE = moment.tz.guess();

const computeDeviceChannelStatus = async (tenant) => {
  try {
    // Connect to MongoDB for device registry and device monitoring
    const deviceRegistryDB = mongoose.connection.useDb(
      `${tenant}_device_registry`
    );
    const deviceMonitoringDB = mongoose.connection.useDb(
      `${tenant}_device_monitoring`
    );

    // Get active devices
    const devices = await deviceRegistryDB
      .collection("devices")
      .find({
        $and: [
          {
            $or: [
              { isActive: true },
              {
                $and: [
                  { mobility: { $exists: true } },
                  { powerType: { $exists: true } },
                ],
              },
            ],
          },
          { network: "airqo" },
        ],
      })
      .toArray();

    const onlineDevices = [];
    const offlineDevices = [];
    let countOfOnlineDevices = 0;
    let countOfOfflineDevices = 0;
    let countOfSolarDevices = 0;
    let countOfAlternatorDevices = 0;
    let countOfMains = 0;
    let countDueMaintenance = 0;
    let countOverdueMaintenance = 0;
    let countUnspecifiedMaintenance = 0;

    // Configuration constants (you might want to move these to a config file)
    const MAX_ONLINE_ACCEPTABLE_DURATION = 3600; // 1 hour
    const DUE_FOR_MAINTENANCE_DURATION = 86400 * 7; // 7 days
    const RECENT_FEEDS_URL = process.env.RECENT_FEEDS_URL;

    // Process each device
    for (const device of devices) {
      try {
        // Fetch device status from channel
        const channelId = device.device_number;
        if (!channelId) continue;

        const response = await axios.get(
          `${RECENT_FEEDS_URL}?channel=${channelId}`,
          {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          }
        );

        if (response.status !== 200) {
          offlineDevices.push({ ...device, elapsed_time: -1 });
          countOfOfflineDevices++;
          continue;
        }

        const result = response.data;
        const currentDateTime = new Date();
        const lastFeedDateTime = new Date(result.created_at);
        const timeDifference = (currentDateTime - lastFeedDateTime) / 1000; // seconds

        // Update device location if not present
        device.latitude = device.latitude || parseFloat(result.latitude);
        device.longitude = device.longitude || parseFloat(result.longitude);

        // Determine online status
        if (timeDifference <= MAX_ONLINE_ACCEPTABLE_DURATION) {
          device.elapsed_time = timeDifference;
          onlineDevices.push(device);
          countOfOnlineDevices++;
        } else {
          device.elapsed_time = timeDifference;
          offlineDevices.push(device);
          countOfOfflineDevices++;
        }

        // Maintenance status
        try {
          const nextMaintenance = new Date(device.nextMaintenance);
          const maintenanceDuration =
            (currentDateTime - nextMaintenance) / 1000;

          if (maintenanceDuration <= 0) {
            if (Math.abs(maintenanceDuration) <= DUE_FOR_MAINTENANCE_DURATION) {
              device.maintenance_status = "due";
              countDueMaintenance++;
            } else {
              device.maintenance_status = "good";
            }
          } else {
            device.maintenance_status = "overdue";
            countOverdueMaintenance++;
          }
        } catch {
          device.nextMaintenance = null;
          device.maintenance_status = -1;
          countUnspecifiedMaintenance++;
        }

        // Power type counting
        const powerType = (
          device.powerType ||
          device.power ||
          ""
        ).toLowerCase();
        switch (powerType) {
          case "solar":
            countOfSolarDevices++;
            break;
          case "mains":
            countOfMains++;
            break;
          case "alternator":
          case "battery":
            countOfAlternatorDevices++;
            break;
        }
      } catch (deviceProcessError) {
        logger.error(
          `Error processing device ${device.device_number}: ${deviceProcessError.message}`
        );
      }
    }

    // Prepare and save device status record
    const deviceStatusRecord = {
      created_at: new Date(),
      total_active_device_count: devices.length,
      count_of_online_devices: countOfOnlineDevices,
      count_of_offline_devices: countOfOfflineDevices,
      count_of_mains: countOfMains,
      count_of_solar_devices: countOfSolarDevices,
      count_of_alternator_devices: countOfAlternatorDevices,
      count_due_maintenance: countDueMaintenance,
      count_overdue_maintenance: countOverdueMaintenance,
      count_unspecified_maintenance: countUnspecifiedMaintenance,
      online_devices: onlineDevices,
      offline_devices: offlineDevices,
    };

    // Save to device monitoring collection
    await deviceMonitoringDB
      .collection("device_status")
      .insertOne(deviceStatusRecord);

    logger.info("Device status check completed successfully");
  } catch (error) {
    logger.error(`Error in device status check: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

// Run the job for 'airqo' tenant
const runDeviceStatusCheck = async () => {
  await computeDeviceChannelStatus("airqo");
};

// Log that the job is starting
logger.info("Device status check job is now running.....");

// Schedule the job (every 2 hours)
cron.schedule("0 */2 * * *", runDeviceStatusCheck, {
  scheduled: true,
  timezone: TIMEZONE,
});

module.exports = { computeDeviceChannelStatus, runDeviceStatusCheck };
