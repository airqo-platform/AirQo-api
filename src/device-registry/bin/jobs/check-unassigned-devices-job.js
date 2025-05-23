const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-unassigned-devices-job`
);
const DeviceModel = require("@models/Device");
const cron = require("node-cron");
const UNASSIGNED_THRESHOLD = 0;
const { logObject, logText } = require("@utils/shared");

const JOB_NAME = "check-unassigned-devices-job";
const JOB_SCHEDULE = "30 */2 * * *"; // At minute 30 of every 2nd hour

const checkUnassignedDevices = async () => {
  try {
    const totalCount = await DeviceModel("airqo").countDocuments({
      isActive: true,
    });

    const result = await DeviceModel("airqo").aggregate([
      {
        $match: {
          isActive: true,
          category: { $exists: false } || { $eq: "" },
        },
      },
      {
        $group: {
          _id: "$name",
        },
      },
    ]);

    const unassignedDevicesCount = result.length;
    const uniqueDeviceNames = result.map((doc) => doc._id);
    logObject("unassignedDevicesCount", unassignedDevicesCount);
    logObject("totalCount ", totalCount);

    if (unassignedDevicesCount === 0) {
      return;
    }

    const percentage = (unassignedDevicesCount / totalCount) * 100;

    logObject("percentage", percentage);

    if (percentage > UNASSIGNED_THRESHOLD) {
      logText(
        `🤦‍♀️🫣 ${percentage.toFixed(
          2
        )}% of deployed devices are not assigned to any category (${uniqueDeviceNames.join(
          ", "
        )})`
      );
      logger.info(
        `🤦‍♀️🫣 ${percentage.toFixed(
          2
        )}% of deployed devices are not assigned to any category (${uniqueDeviceNames.join(
          ", "
        )})`
      );
    }
  } catch (error) {
    logText(`🐛🐛 Error checking unassigned devices: ${error.message}`);
    logger.error(`🐛🐛 Error checking unassigned devices: ${error.message}`);
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
};

// Create and register the job
const startJob = () => {
  // Create the cron job instance 👇 THIS IS THE cronJobInstance!
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, checkUnassignedDevices, {
    scheduled: true,
    timezone: constants.TIMEZONE,
  });

  // Initialize global registry
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  // Register for cleanup 👇 USING cronJobInstance HERE!
  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      cronJobInstance.stop();
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

//Start the job
startJob();
