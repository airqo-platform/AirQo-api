const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-active-statuses-job`
);
const DeviceModel = require("@models/Device");
const cron = require("node-cron");
const moment = require("moment-timezone"); // Import moment-timezone
const ACTIVE_STATUS_THRESHOLD = 0;
const { logText, logObject } = require("@utils/log");

// Configure timezone (e.g., 'UTC')
const TIMEZONE = 'UTC'; // You can change this to your desired timezone
const MAX_RETRIES = 3; // Maximum retry attempts
const RETRY_DELAY = 5000; // Delay between retries in milliseconds

const checkActiveStatuses = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Check for Deployed devices with incorrect statuses
      const activeIncorrectStatusCount = await DeviceModel("airqo").countDocuments({
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
      break; // Exit loop if successful
    } catch (error) {
      logText(`🐛🐛 Error checking active statuses (Attempt ${attempt}): ${error.message}`);
      logger.error(`🐛🐛 Error checking active statuses (Attempt ${attempt}): ${error.message}`);
      logger.error(`🐛🐛 Stack trace: ${error.stack}`);

      if (attempt < MAX_RETRIES) {
        logger.warn(`Retry attempt ${attempt} due to error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY)); // Wait before retrying
      } else {
        logText("Maximum retry attempts reached. Job failed.");
        logger.error("Maximum retry attempts reached. Job failed.");
      }
    }
  }
};

// Schedule job with timezone configuration
logText("Active statuses job is now running.....");
const schedule = '30 */2 * * *'; // At minute 30 of every 2nd hour
cron.schedule(schedule, async () => {
  const currentTime = moment.tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss');
  logger.info(`Running job at ${currentTime}`);
  await checkActiveStatuses();
}, {
  scheduled: true,
  timezone: TIMEZONE, // Set the desired timezone
  retry: {
    retries: MAX_RETRIES,
    onRetry: (error, attempt) => {
      logger.warn(`Retry attempt ${attempt} due to error: ${error.message}`);
    }
  }
});
