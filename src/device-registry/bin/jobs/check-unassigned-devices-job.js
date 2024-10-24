const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-unassigned-devices-job`
);
const DeviceModel = require("@models/Device");
const cron = require("node-cron");
const UNASSIGNED_THRESHOLD = 0;
const { logText, logObject } = require("@utils/log");

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

logText("Unassigned devices job is now running.....");
const schedule = "30 */2 * * *"; // At minute 30 of every 2nd hour
cron.schedule(schedule, checkUnassignedDevices, {
  scheduled: true,
});
