const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/device-status-check-job`
);
const cron = require("node-cron");
const moment = require("moment-timezone");
const axios = require("axios");
const { logObject, logText } = require("@utils/shared");
const DeviceModel = require("@models/Device");
const DeviceStatusModel = require("@models/DeviceStatus");

const TIMEZONE = moment.tz.guess();
const MAX_ONLINE_ACCEPTABLE_DURATION = 3600; // 1 hour
const DUE_FOR_MAINTENANCE_DURATION = 86400 * 7; // 7 days
const BATCH_SIZE = 100; // Process devices in batches for better memory management

const JOB_NAME = "device-status-check-job";
const JOB_SCHEDULE = "0 */2 * * *"; // At minute 0 of every 2nd hour

const processDeviceBatch = async (devices) => {
  const metrics = {
    online: { count: 0, devices: [] },
    offline: { count: 0, devices: [] },
    power: { solar: 0, mains: 0, alternator: 0 },
    maintenance: { due: 0, overdue: 0, unspecified: 0 },
  };

  const currentDateTime = new Date();

  await Promise.all(
    devices.map(async (device) => {
      try {
        if (!device.device_number) return;

        const response = await axios.get(
          `${process.env.RECENT_FEEDS_URL}?channel=${device.device_number}`,
          {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 5000, // Add timeout to prevent hanging requests
          }
        );

        const deviceStatus = {
          device_id: device._id,
          name: device.name,
          latitude: device.latitude,
          longitude: device.longitude,
        };

        if (response.status === 200) {
          const result = response.data;
          const lastFeedDateTime = new Date(result.created_at);
          const timeDifference = (currentDateTime - lastFeedDateTime) / 1000;

          deviceStatus.elapsed_time = timeDifference;

          if (timeDifference <= MAX_ONLINE_ACCEPTABLE_DURATION) {
            metrics.online.devices.push(deviceStatus);
            metrics.online.count++;
          } else {
            metrics.offline.devices.push(deviceStatus);
            metrics.offline.count++;
          }

          // Update power metrics
          const powerType = (
            device.powerType ||
            device.power ||
            ""
          ).toLowerCase();
          if (powerType === "solar") metrics.power.solar++;
          else if (powerType === "mains") metrics.power.mains++;
          else if (["alternator", "battery"].includes(powerType))
            metrics.power.alternator++;

          // Update maintenance metrics
          if (device.nextMaintenance) {
            const maintenanceDuration =
              (currentDateTime - new Date(device.nextMaintenance)) / 1000;
            if (
              maintenanceDuration <= 0 &&
              Math.abs(maintenanceDuration) <= DUE_FOR_MAINTENANCE_DURATION
            ) {
              metrics.maintenance.due++;
            } else if (maintenanceDuration > 0) {
              metrics.maintenance.overdue++;
            }
          } else {
            metrics.maintenance.unspecified++;
          }
        } else {
          metrics.offline.devices.push({ ...deviceStatus, elapsed_time: -1 });
          metrics.offline.count++;
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

const computeDeviceChannelStatus = async (tenant) => {
  try {
    const startTime = Date.now();
    logText("Starting device status check...");

    // Get active devices count first
    const totalActiveDevices = await DeviceModel(tenant).countDocuments({
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
    });

    // Process devices in batches
    let processedCount = 0;
    const finalMetrics = {
      online: { count: 0, devices: [] },
      offline: { count: 0, devices: [] },
      power: { solar: 0, mains: 0, alternator: 0 },
      maintenance: { due: 0, overdue: 0, unspecified: 0 },
    };

    while (processedCount < totalActiveDevices) {
      const devices = await DeviceModel(tenant)
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
        .skip(processedCount)
        .limit(BATCH_SIZE)
        .lean();

      const batchMetrics = await processDeviceBatch(devices);

      // Merge batch metrics with final metrics
      Object.keys(finalMetrics).forEach((key) => {
        if (Array.isArray(finalMetrics[key].devices)) {
          finalMetrics[key].devices.push(...batchMetrics[key].devices);
          finalMetrics[key].count += batchMetrics[key].count;
        } else {
          Object.keys(finalMetrics[key]).forEach((subKey) => {
            finalMetrics[key][subKey] += batchMetrics[key][subKey];
          });
        }
      });

      processedCount += devices.length;
      logText(`Processed ${processedCount}/${totalActiveDevices} devices`);
    }

    // Save status record
    const deviceStatusRecord = new DeviceStatusModel({
      created_at: new Date(),
      total_active_device_count: totalActiveDevices,
      metrics: {
        online: {
          count: finalMetrics.online.count,
          devices: finalMetrics.online.devices,
        },
        offline: {
          count: finalMetrics.offline.count,
          devices: finalMetrics.offline.devices,
        },
      },
      power_metrics: finalMetrics.power,
      maintenance_metrics: finalMetrics.maintenance,
    });

    await deviceStatusRecord.save();

    const duration = (Date.now() - startTime) / 1000;
    logText(`Device status check completed in ${duration}s`);
    logObject("Final metrics", finalMetrics);
  } catch (error) {
    logger.error(`Error in device status check: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
  }
};

// Run the job for 'airqo' tenant
const runDeviceStatusCheck = async () => {
  await computeDeviceChannelStatus("airqo");
};

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = runDeviceStatusCheck();
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

module.exports = { computeDeviceChannelStatus, runDeviceStatusCheck };
