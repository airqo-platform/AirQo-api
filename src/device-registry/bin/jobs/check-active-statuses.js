const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-active-statuses-job`
);
const DeviceModel = require("@models/Device");
const cron = require("node-cron");
const ACTIVE_STATUS_THRESHOLD = 0;
const { getSchedule, LogThrottleManager } = require("@utils/common");
const moment = require("moment-timezone");
const { logObject, logText } = require("@utils/shared");

const JOB_NAME = "check-active-statuses-job";
const JOB_SCHEDULE = getSchedule("30 */2 * * *", constants.ENVIRONMENT); // At minute 30 (or offset) of every 2nd hour
const TIMEZONE = moment.tz.guess();
const LOG_TYPE = "ACTIVE_STATUSES_CHECK";

let isJobRunning = false;
let currentJobPromise = null;

const logThrottleManager = new LogThrottleManager();

const checkActiveStatuses = async () => {
  // Prevent overlapping executions
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;

  try {
    // Check if job should stop (for graceful shutdown)
    if (global.isShuttingDown) {
      return;
    }

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

    // Check again if we should stop (long-running operations)
    if (global.isShuttingDown) {
      return;
    }

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
        `⁉️ Issues found with active device statuses. Checking log throttle...`
      );

      const shouldLog = await logThrottleManager.shouldAllowLog(LOG_TYPE);

      if (shouldLog) {
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
      } else {
        logger.debug(`Log throttled for ${LOG_TYPE}: Daily limit reached.`);
      }
    }
  } catch (error) {
    logText(`🐛🐛 Error checking active statuses: ${error.message}`);
    logger.error(
      `🐛🐛 ${JOB_NAME} Error checking active statuses: ${error.message}`
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// Wrapper function to handle promises for graceful shutdown
const jobWrapper = async () => {
  currentJobPromise = checkActiveStatuses();
  await currentJobPromise;
};

// Create and start the cron job
const startCheckActiveStatusesJob = () => {
  try {
    // THIS IS WHERE cronJobInstance IS CREATED! 👇
    const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
      scheduled: true,
      timezone: TIMEZONE,
    });

    // Initialize global cronJobs if it doesn't exist
    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    // Register this job in the global registry for cleanup
    global.cronJobs[JOB_NAME] = {
      job: cronJobInstance, // 👈 Here's the cronJobInstance!
      name: JOB_NAME,
      schedule: JOB_SCHEDULE,
      stop: async () => {
        try {
          // Stop the cron schedule
          cronJobInstance.stop(); // 👈 Using the cronJobInstance here

          // Wait for current execution to finish if running
          if (currentJobPromise) {
            logText(
              `⏳ Waiting for current ${JOB_NAME} execution to finish...`
            );
            await currentJobPromise;
            logText(`✅ Current ${JOB_NAME} execution completed`);
          }

          // Remove from global registry
          delete global.cronJobs[JOB_NAME];
        } catch (error) {
          logger.error(`❌ Error stopping ${JOB_NAME}: ${error.message}`);
        }
      },
    };

    logText(`✅ ${JOB_NAME} registered and started successfully`);
    logText("Active statuses job is now running.....");

    return global.cronJobs[JOB_NAME];
  } catch (error) {
    logger.error(`❌ Failed to start ${JOB_NAME}: ${error.message}`);
    throw error;
  }
};

// Graceful shutdown handlers for this specific job
const handleShutdown = async (signal) => {
  logText(`📨 ${JOB_NAME} received ${signal} signal`);

  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    await global.cronJobs[JOB_NAME].stop();
  }

  logText(`👋 ${JOB_NAME} shutdown complete`);
};

// Register shutdown handlers if not already done globally
if (!global.jobShutdownHandlersRegistered) {
  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  global.jobShutdownHandlersRegistered = true;
}

// Handle uncaught exceptions in this job
process.on("uncaughtException", (error) => {
  logger.error(`💥 Uncaught Exception in ${JOB_NAME}: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    `🚫 Unhandled Rejection in ${JOB_NAME} at:`,
    promise,
    "reason:",
    reason
  );
});

// Start the job
try {
  startCheckActiveStatusesJob();
  logText(`🎉 ${JOB_NAME} initialization complete`);
} catch (error) {
  logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  process.exit(1);
}

// Export for testing or manual control
module.exports = {
  JOB_NAME,
  JOB_SCHEDULE,
  startCheckActiveStatusesJob,
  checkActiveStatuses,
  stopJob: async () => {
    if (global.cronJobs && global.cronJobs[JOB_NAME]) {
      await global.cronJobs[JOB_NAME].stop();
    }
  },
};
