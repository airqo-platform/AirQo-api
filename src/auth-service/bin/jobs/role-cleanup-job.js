const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- role-cleanup-job`);
const cron = require("node-cron");
const moment = require("moment-timezone");
const UserModel = require("@models/User");
const userUtil = require("@utils/user.util");

const TIMEZONE = "Africa/Nairobi";
const JOB_NAME = "role-cleanup-job";
const JOB_SCHEDULE = "0 3 * * *"; // Every day at 3 AM
const BATCH_SIZE = 100; // Process 100 users at a time
const MAX_EXECUTION_TIME = 55 * 60 * 1000; // 55 minutes max execution
const YIELD_INTERVAL = 10; // Yield every 10 operations

class NonBlockingJobProcessor {
  constructor(jobName) {
    this.jobName = jobName;
    this.startTime = null;
    this.isRunning = false;
    this.shouldStop = false;
    this.operationCount = 0;
  }

  start() {
    this.startTime = Date.now();
    this.isRunning = true;
    this.shouldStop = false;
    this.operationCount = 0;
  }

  end() {
    this.isRunning = false;
    this.shouldStop = false;
  }

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

  async yieldControl() {
    return new Promise((resolve) => {
      setImmediate(resolve);
    });
  }

  async processWithYielding(operation) {
    this.operationCount++;
    if (this.operationCount % YIELD_INTERVAL === 0) {
      await this.yieldControl();
      if (this.shouldStopExecution()) {
        throw new Error(`${this.jobName} stopped execution`);
      }
    }
    return await operation();
  }

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
        if (error.message.includes("stopped execution")) {
          break;
        }
      }
    }
    return { results, errors, processed: results.length };
  }
}

const cleanupUserRolesJob = async () => {
  const processor = new NonBlockingJobProcessor(JOB_NAME);
  const tenant = constants.DEFAULT_TENANT || "airqo";

  try {
    processor.start();
    logger.info(`Starting ${JOB_NAME} for tenant ${tenant}...`);

    const totalUsers = await UserModel(tenant).countDocuments();
    logger.info(`${JOB_NAME}: Found ${totalUsers} total users to process.`);

    let skip = 0;
    let totalProcessed = 0;

    while (skip < totalUsers && !processor.shouldStopExecution()) {
      const batch = await UserModel(tenant)
        .find()
        .skip(skip)
        .limit(BATCH_SIZE)
        .lean();

      if (batch.length === 0) break;

      const batchResult = await processor.processBatch(batch, async (user) => {
        return await userUtil.ensureDefaultAirqoRole(user, tenant);
      });

      totalProcessed += batchResult.processed;
      skip += BATCH_SIZE;

      logger.debug(
        `${JOB_NAME}: Processed ${totalProcessed}/${totalUsers} users`
      );

      await processor.yieldControl();
    }

    logger.info(
      `${JOB_NAME} completed: processed ${totalProcessed} users in ${
        Date.now() - processor.startTime
      }ms`
    );
  } catch (error) {
    if (error.message.includes("stopped execution")) {
      logger.info(`${JOB_NAME} stopped gracefully.`);
    } else {
      logger.error(`${JOB_NAME} error: ${error.message}`);
    }
  } finally {
    processor.end();
  }
};

if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
  cron.schedule(JOB_SCHEDULE, cleanupUserRolesJob, {
    scheduled: true,
    timezone: TIMEZONE,
  });
}

module.exports = {
  cleanupUserRolesJob,
};
