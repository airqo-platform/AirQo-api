const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/store-signals-job`
);
const EventModel = require("@models/Event");
const SignalModel = require("@models/Signal");
const { logObject, logText } = require("@utils/shared");
const asyncRetry = require("async-retry");
const { stringify, generateFilter } = require("@utils/common");
const cron = require("node-cron");

// Job identification
const JOB_NAME = "store-signals-job";
const JOB_SCHEDULE = "15 * * * *";

let isJobRunning = false;
let currentJobPromise = null;

const fetchAndStoreDataIntoSignalsModel = async () => {
  // Prevent overlapping executions
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;

  try {
    const request = {
      query: {
        tenant: "airqo",
        recent: "yes",
        metadata: "site_id",
        active: "yes",
        brief: "yes",
      },
    };
    const filter = generateFilter.fetch(request);

    // Fetch the data
    const viewEventsResponse = await EventModel("airqo").signal(filter);
    logText("we are running the data insertion script");

    if (viewEventsResponse.success === true) {
      const data = viewEventsResponse.data[0].data;
      if (!data) {
        logText(`🐛🐛 Didn't find any Events to insert into Signals`);
        logger.error(`🐛🐛 Didn't find any Events to insert into Signals`);
        return {
          success: true,
          message: `🐛🐛 Didn't find any Events to insert into Signals`,
          status: 200,
        };
      }

      // Prepare the data for batch insertion
      const batchSize = 50; // Adjust this value based on your requirements
      const batches = [];
      for (let i = 0; i < data.length; i += batchSize) {
        batches.push(data.slice(i, i + batchSize));
      }

      // Insert each batch in the 'signals' collection with retry logic
      for (const batch of batches) {
        for (const doc of batch) {
          // Check if job should stop (for graceful shutdown)
          if (global.isShuttingDown) {
            logText(`${JOB_NAME} stopping due to application shutdown`);
            return;
          }

          await asyncRetry(
            async (bail) => {
              try {
                // logObject("document", doc);
                const buildDocumentFilter = (doc) => {
                  const baseFilter = { time: doc.time };

                  // For static devices, use site_id
                  if (doc.site_id) {
                    return { ...baseFilter, site_id: doc.site_id };
                  }

                  // For mobile devices, use grid_id
                  if (doc.grid_id) {
                    return { ...baseFilter, grid_id: doc.grid_id };
                  }

                  // Fallback to device_id if neither location is available
                  if (doc.device_id) {
                    return { ...baseFilter, device_id: doc.device_id };
                  }

                  throw new Error(
                    "Document must have either site_id, grid_id, or device_id for filtering"
                  );
                };

                const filter = buildDocumentFilter(doc);
                const updateDoc = { ...doc };
                delete updateDoc._id; // Remove the _id field
                const res = await SignalModel("airqo").updateOne(
                  filter,
                  updateDoc,
                  {
                    upsert: true,
                  }
                );
                // logObject("res", res);
                // logObject("Number of documents updated", res.modifiedCount);
              } catch (error) {
                if (error.name === "MongoError" && error.code !== 11000) {
                  logger.error(
                    `🐛🐛 MongoError -- fetchAndStoreDataIntoSignalsModel -- ${stringify(
                      error
                    )}`
                  );
                  throw error; // Retry the operation
                } else if (error.code === 11000) {
                  // Ignore duplicate key errors
                  console.warn(
                    `Duplicate key error for document: ${stringify(doc)}`
                  );
                }
              }
            },
            {
              retries: 3, // Number of retry attempts
              minTimeout: 1000, // Initial delay between retries (in milliseconds)
              factor: 2, // Exponential factor for increasing delay between retries
            }
          );
        }
      }

      logText(`All data inserted successfully`);
      return;
    } else {
      logObject(
        `🐛🐛 Unable to retrieve Events to insert into Signals`,
        viewEventsResponse
      );

      logger.error(
        `🐛🐛 Unable to retrieve Events to insert into Signals -- ${stringify(
          viewEventsResponse
        )}`
      );
      logText(`🐛🐛 Unable to retrieve Events to insert into Signals`);
      return;
    }
  } catch (error) {
    logObject("error", error);
    logger.error(`🐛🐛 ${JOB_NAME} Internal Server Error: ${error.message}`);
    return;
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

const jobWrapper = async () => {
  try {
    currentJobPromise = fetchAndStoreDataIntoSignalsModel();
    await currentJobPromise;
  } catch (error) {
    // Handle any unhandled errors from the job execution
    logger.error(`💥 Unhandled error in ${JOB_NAME}: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);

    // Reset job state in case of error
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// Create and start the cron job
const startStoreSignalsJob = () => {
  try {
    const job = cron.schedule(JOB_SCHEDULE, jobWrapper, {
      scheduled: true,
      timezone: "Africa/Nairobi",
    });

    // Initialize global cronJobs if it doesn't exist
    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    // Register this job in the global registry for cleanup
    global.cronJobs[JOB_NAME] = {
      job: job,
      name: JOB_NAME,
      schedule: JOB_SCHEDULE,
      stop: async () => {
        logText(`🛑 Stopping ${JOB_NAME}...`);

        try {
          // Stop the cron schedule
          job.stop();
          logText(`📅 ${JOB_NAME} schedule stopped`);

          // Wait for current execution to finish if running
          if (currentJobPromise) {
            logText(
              `⏳ Waiting for current ${JOB_NAME} execution to finish...`
            );
            await currentJobPromise;
            logText(`✅ Current ${JOB_NAME} execution completed`);
          }

          logText(`✅ ${JOB_NAME} stopped successfully`);

          // Remove from global registry
          delete global.cronJobs[JOB_NAME];
        } catch (error) {
          logger.error(`❌ Error stopping ${JOB_NAME}: ${error.message}`);
        }
      },
    };

    logText(`✅ ${JOB_NAME} registered and started successfully`);

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

// Start the job
try {
  startStoreSignalsJob();
  logText(`🎉 ${JOB_NAME} initialization complete`);
} catch (error) {
  logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  process.exit(1);
}

// Export for testing or manual control
module.exports = {
  JOB_NAME,
  JOB_SCHEDULE,
  startStoreSignalsJob,
  fetchAndStoreDataIntoSignalsModel,
  stopJob: async () => {
    if (global.cronJobs && global.cronJobs[JOB_NAME]) {
      await global.cronJobs[JOB_NAME].stop();
    }
  },
};
