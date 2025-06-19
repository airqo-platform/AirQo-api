// Replace the entire incomplete-profile-job.js file content

const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/incomplete-profile-job`
);
const {
  winstonLogger,
  mailer,
  stringify,
  date,
  msgs,
  emailTemplates,
  generateFilter,
  handleResponse,
} = require("@utils/common");
const { logObject, logText } = require("@utils/shared");

// Job identification
const JOB_NAME = "incomplete-profile-job";
const JOB_SCHEDULE = "0 0 * * *"; // every day at midnight
const BATCH_SIZE = 100;

let isJobRunning = false;
let currentJobPromise = null;

const checkStatus = async () => {
  // Prevent overlapping executions
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  let totalProcessed = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;

  try {
    logText(`🚀 Starting ${JOB_NAME} execution`);

    let skip = 0;

    while (true) {
      // Check if job should stop (for graceful shutdown)
      if (global.isShuttingDown) {
        logText(`🛑 ${JOB_NAME} stopping due to shutdown signal`);

        break;
      }

      const users = await UserModel("airqo")
        .find({
          firstName: "Unknown",
          isActive: { $ne: false },
        })
        .limit(BATCH_SIZE)
        .skip(skip)
        .select("_id email")
        .lean();

      if (users.length === 0) {
        logText(`✅ ${JOB_NAME} completed - no more users to process`);

        break;
      }

      logText(`📧 Processing batch of ${users.length} users (skip: ${skip})`);

      for (const user of users) {
        // Check shutdown signal frequently during processing
        if (global.isShuttingDown) {
          logText(
            `🛑 ${JOB_NAME} stopping due to shutdown signal during user processing`
          );

          break;
        }

        try {
          totalProcessed++;
          const emailResponse = await mailer.updateProfileReminder({
            email: user.email,
          });

          if (emailResponse && emailResponse.success === false) {
            totalFailed++;
            logger.error(
              `🐛🐛 Failed to send email to ${user.email} -- ${stringify(
                emailResponse
              )}`
            );
          } else {
            totalSuccessful++;
            logger.debug(`✅ Email sent successfully to ${user.email}`);
          }
        } catch (error) {
          totalFailed++;
          logger.error(
            `❌ Failed to send email to ${user.email} --- ${stringify(error)}`
          );
        }
      }

      // Break if shutdown signal received during user processing
      if (global.isShuttingDown) {
        break;
      }

      skip += BATCH_SIZE;
    }

    // Log summary
    logText(
      `📊 ${JOB_NAME} Summary: Processed: ${totalProcessed}, Successful: ${totalSuccessful}, Failed: ${totalFailed}`
    );
  } catch (error) {
    logger.error(
      `🐛🐛 ${JOB_NAME} Internal Server Error --- ${stringify(error)}`
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
    logText(`🏁 ${JOB_NAME} execution finished`);
  }
};

// Wrapper function to handle promises for graceful shutdown
const jobWrapper = async () => {
  currentJobPromise = checkStatus();
  await currentJobPromise;
};

// Create and start the cron job
const startIncompleteProfileJob = () => {
  try {
    const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
      scheduled: true,
      timezone: "Africa/Nairobi",
    });

    // Initialize global cronJobs if it doesn't exist
    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    // Register this job in the global registry for cleanup
    global.cronJobs[JOB_NAME] = {
      job: cronJobInstance,
      name: JOB_NAME,
      schedule: JOB_SCHEDULE,
      stop: async () => {
        try {
          logText(`🛑 Stopping ${JOB_NAME}...`);

          // Stop the cron schedule
          cronJobInstance.stop();
          logText(`📅 Stopped schedule for ${JOB_NAME}`);

          // Wait for current execution to finish if running
          if (currentJobPromise) {
            logText(
              `⏳ Waiting for current ${JOB_NAME} execution to finish...`
            );

            await currentJobPromise;
            logText(`✅ Current ${JOB_NAME} execution completed`);
          }

          // Destroy the job if destroy method exists
          if (typeof cronJobInstance.destroy === "function") {
            cronJobInstance.destroy();
            logText(`💥 ${JOB_NAME} destroyed successfully`);
          } else {
            logText(
              `⚠️  ${JOB_NAME} destroy method not available (older node-cron version)`
            );
            logger.warn(
              `${JOB_NAME} destroy method not available (older node-cron version)`
            );
          }

          // Remove from global registry
          delete global.cronJobs[JOB_NAME];
          logText(`🗑️  ${JOB_NAME} removed from global registry`);
        } catch (error) {
          logger.error(`❌ Error stopping ${JOB_NAME}: ${error.message}`);
          throw error;
        }
      },
    };

    logText(`✅ ${JOB_NAME} registered and started successfully`);

    logText(
      `⏰ ${JOB_NAME} scheduled: ${JOB_SCHEDULE} (Africa/Nairobi timezone)`
    );

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
  startIncompleteProfileJob();
  logText(`🎉 ${JOB_NAME} initialization complete`);
} catch (error) {
  logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  process.exit(1);
}

// Export for testing or manual control
module.exports = {
  JOB_NAME,
  JOB_SCHEDULE,
  startIncompleteProfileJob,
  checkStatus,
  stopJob: async () => {
    if (global.cronJobs && global.cronJobs[JOB_NAME]) {
      await global.cronJobs[JOB_NAME].stop();
    }
  },
};
