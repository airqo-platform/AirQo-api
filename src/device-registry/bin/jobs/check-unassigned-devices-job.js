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

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = checkUnassignedDevices();
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
    timezone: constants.TIMEZONE,
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

//Start the job
startJob();
