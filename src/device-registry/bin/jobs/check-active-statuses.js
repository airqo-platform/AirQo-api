const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-active-statuses-job`
);
const DeviceModel = require("@models/Device");
const cron = require("node-cron");
const ACTIVE_STATUS_THRESHOLD = 0;
const { logObject, logText } = require("@utils/shared");

const checkActiveStatuses = async () => {
  try {
    // Check for Deployed devices with incorrect statuses
    const activeIncorrectStatusCount = await DeviceModel(
      "airqo"
    ).countDocuments({
      isActive: true,
      status: { $ne: "deployed" },
    });

    const activeMissingStatusCount = await DeviceModel("airqo").countDocuments({
      isActive: true,
      status: { $exists: false } || { $eq: null } || { $eq: "" },
    });

    const activeIncorrectStatusResult = await DeviceModel("airqo").aggregate([
      {
        $match: {
          isActive: true,
          status: { $ne: "deployed" },
        },
      },
      {
        $group: {
          _id: "$name",
        },
      },
    ]);

    const activeMissingStatusResult = await DeviceModel("airqo").aggregate([
      {
        $match: {
          isActive: true,
          status: { $exists: false } || { $eq: null } || { $eq: "" },
        },
      },
      {
        $group: {
          _id: "$name",
        },
      },
    ]);

    const activeIncorrectStatusUniqueNames = activeIncorrectStatusResult.map(
      (doc) => doc._id
    );
    const activeMissingStatusUniqueNames = activeMissingStatusResult.map(
      (doc) => doc._id
    );

    logObject("activeIncorrectStatusCount", activeIncorrectStatusCount);
    logObject("activeMissingStatusCount", activeMissingStatusCount);
    const totalActiveDevices = await DeviceModel("airqo").countDocuments({
      isActive: true,
    });

    const percentageActiveIncorrectStatus =
      (activeIncorrectStatusCount / totalActiveDevices) * 100;
    const percentageActiveMissingStatus =
      (activeMissingStatusCount / totalActiveDevices) * 100;

    logObject(
      "percentageActiveIncorrectStatus",
      percentageActiveIncorrectStatus
    );
    logObject("percentageActiveMissingStatus", percentageActiveMissingStatus);

    if (
      percentageActiveIncorrectStatus > ACTIVE_STATUS_THRESHOLD ||
      percentageActiveMissingStatus > ACTIVE_STATUS_THRESHOLD
    ) {
      logText(
        `⁉️ Deployed devices with incorrect statuses (${activeIncorrectStatusUniqueNames.join(
          ", "
        )}) - ${percentageActiveIncorrectStatus.toFixed(2)}%`
      );
      logger.info(
        `⁉️ Deployed devices with incorrect statuses (${activeIncorrectStatusUniqueNames.join(
          ", "
        )}) - ${percentageActiveIncorrectStatus.toFixed(2)}%`
      );

      logText(
        `⁉️ Deployed devices missing status (${activeMissingStatusUniqueNames.join(
          ", "
        )}) - ${percentageActiveMissingStatus.toFixed(2)}%`
      );
      logger.info(
        `⁉️ Deployed devices missing status (${activeMissingStatusUniqueNames.join(
          ", "
        )}) - ${percentageActiveMissingStatus.toFixed(2)}%`
      );
    }
  } catch (error) {
    logText(`🐛🐛 Error checking active statuses: ${error.message}`);
    logger.error(`🐛🐛 Error checking active statuses: ${error.message}`);
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
};

logText("Active statuses job is now running.....");
const schedule = "30 */2 * * *"; // At minute 30 of every 2nd hour
cron.schedule(schedule, checkActiveStatuses, {
  scheduled: true,
});
