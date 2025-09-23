// Example enhanced job template with non-blocking guarantees
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- example-job`);
const cron = require("node-cron");
const moment = require("moment-timezone");

const TIMEZONE = moment.tz.guess();
const JOB_NAME = "example-job";
const JOB_SCHEDULE = "0 * * * *"; // Every hour
const BATCH_SIZE = 50; // Smaller batches for better yielding
const MAX_EXECUTION_TIME = 5 * 60 * 1000; // 5 minutes max execution
const YIELD_INTERVAL = 10; // Yield every 10 operations

class NonBlockingJobProcessor {
  constructor(jobName) {
    this.jobName = jobName;
    this.startTime = null;
    this.isRunning = false;
    this.shouldStop = false;
    this.operationCount = 0;
  }

  // Start job with monitoring
  start() {
    if (global.jobMetrics) {
      global.jobMetrics.startJob(this.jobName);
    }
    this.startTime = Date.now();
    this.isRunning = true;
    this.shouldStop = false;
    this.operationCount = 0;
  }

  // End job with monitoring
  end() {
    if (global.jobMetrics) {
      global.jobMetrics.endJob(this.jobName);
    }
    this.isRunning = false;
    this.shouldStop = false;
  }

  // Check if job should stop (timeout or shutdown)
  shouldStopExecution() {
    if (global.isShuttingDown) {
      logger.info(`${this.jobName} stopping due to application shutdown`);
      return true;
    }

    if (this.startTime && Date.now() - this.startTime > MAX_EXECUTION_TIME) {
      logger.warn(
        `${this.jobName} stopping due to timeout (${MAX_EXECUTION_TIME}ms)`
      );
      return true;
    }

    return this.shouldStop;
  }

  // Yield control back to event loop
  async yieldControl() {
    return new Promise((resolve) => {
      setImmediate(resolve);
    });
  }

  // Process operations with automatic yielding
  async processWithYielding(operation) {
    this.operationCount++;

    // Yield control every N operations
    if (this.operationCount % YIELD_INTERVAL === 0) {
      await this.yieldControl();

      // Check if we should stop after yielding
      if (this.shouldStopExecution()) {
        throw new Error(`${this.jobName} stopped execution`);
      }
    }

    return await operation();
  }

  // Process batch with proper yielding and error handling
  async processBatch(items, processingFunction) {
    const results = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      try {
        if (this.shouldStopExecution()) {
          logger.info(
            `${this.jobName} batch processing stopped at item ${i}/${items.length}`
          );
          break;
        }

        const result = await this.processWithYielding(async () => {
          return await processingFunction(items[i], i);
        });

        results.push(result);
      } catch (error) {
        logger.error(
          `${this.jobName} error processing item ${i}: ${error.message}`
        );
        errors.push({ index: i, error: error.message });

        // Continue processing other items unless it's a stop signal
        if (error.message.includes("stopped execution")) {
          break;
        }
      }
    }

    return { results, errors, processed: results.length };
  }

  // Get job statistics
  getStats() {
    return {
      jobName: this.jobName,
      isRunning: this.isRunning,
      operationCount: this.operationCount,
      executionTime: this.startTime ? Date.now() - this.startTime : 0,
      shouldStop: this.shouldStop,
    };
  }
}

// Example job implementation
const exampleJob = async () => {
  const processor = new NonBlockingJobProcessor(JOB_NAME);

  try {
    processor.start();
    logger.info(`Starting ${JOB_NAME}...`);

    // Example: Fetch data in batches
    const totalItems = await SomeModel.countDocuments();
    logger.info(`${JOB_NAME}: Processing ${totalItems} items`);

    let skip = 0;
    let totalProcessed = 0;

    while (skip < totalItems && !processor.shouldStopExecution()) {
      // Fetch batch
      const batch = await SomeModel.find()
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      if (batch.length === 0) break;

      // Process batch with yielding
      const batchResult = await processor.processBatch(
        batch,
        async (item, index) => {
          // Your actual processing logic here
          // This function should be fast and focused
          return await processItem(item);
        }
      );

      totalProcessed += batchResult.processed;
      skip += BATCH_SIZE;

      logger.debug(
        `${JOB_NAME}: Processed ${totalProcessed}/${totalItems} items`
      );

      // Yield between batches
      await processor.yieldControl();
    }

    logger.info(
      `${JOB_NAME} completed: processed ${totalProcessed} items in ${Date.now() -
        processor.startTime}ms`
    );
  } catch (error) {
    if (error.message.includes("stopped execution")) {
      logger.info(`${JOB_NAME} stopped gracefully`);
    } else {
      logger.error(`${JOB_NAME} error: ${error.message}`);
    }
  } finally {
    processor.end();
  }
};

// Example item processing function
async function processItem(item) {
  // Keep individual item processing fast
  // If you need to do complex operations, break them into smaller chunks

  // Example: Database update
  await SomeModel.findByIdAndUpdate(item._id, {
    processed: true,
    processedAt: new Date(),
  });

  return { id: item._id, status: "processed" };
}

// Job scheduling with proper error handling
const startJob = () => {
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    return;
  }

  try {
    let isJobRunning = false;
    let currentJobPromise = null;

    const cronJobInstance = cron.schedule(
      JOB_SCHEDULE,
      async () => {
        if (isJobRunning) {
          logger.warn(`${JOB_NAME} is already running, skipping execution`);
          return;
        }

        isJobRunning = true;
        currentJobPromise = exampleJob();

        try {
          await currentJobPromise;
        } catch (error) {
          logger.error(`${JOB_NAME} execution error: ${error.message}`);
        } finally {
          isJobRunning = false;
          currentJobPromise = null;
        }
      },
      {
        scheduled: true,
        timezone: TIMEZONE,
      }
    );

    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    global.cronJobs[JOB_NAME] = {
      job: cronJobInstance,
      stop: async () => {
        logger.info(`Stopping ${JOB_NAME}...`);
        cronJobInstance.stop();

        if (currentJobPromise) {
          logger.info(`Waiting for ${JOB_NAME} to finish...`);
          try {
            await Promise.race([
              currentJobPromise,
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Job stop timeout")), 10000)
              ),
            ]);
          } catch (error) {
            logger.warn(`${JOB_NAME} stop timeout: ${error.message}`);
          }
        }

        if (typeof cronJobInstance.destroy === "function") {
          cronJobInstance.destroy();
        }
        delete global.cronJobs[JOB_NAME];
        logger.info(`${JOB_NAME} stopped successfully`);
      },
    };

    console.log(`✅ ${JOB_NAME} started`);
  } catch (error) {
    logger.error(`Failed to initialize ${JOB_NAME}: ${error.message}`);
  }
};

// Defer job start to prevent blocking server startup
process.nextTick(startJob);

module.exports = {
  exampleJob,
  NonBlockingJobProcessor,
};
