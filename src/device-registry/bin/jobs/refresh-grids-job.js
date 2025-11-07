const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/refresh-grids-job`
);
const cron = require("node-cron");
const moment = require("moment-timezone");
const GridModel = require("@models/Grid");
const gridUtil = require("@utils/grid.util");
const { logObject, logText } = require("@utils/shared");

const TIMEZONE = constants.TIMEZONE || "Africa/Kampala";
const JOB_NAME = "refresh-grids-job";
const JOB_SCHEDULE = "0 0,12 * * *"; // Twice a day (midnight and noon)
const BATCH_SIZE = constants.BATCH_SIZE_FOR_GRID_REFRESH || 50;
const MAX_EXECUTION_TIME =
  constants.MAX_EXECUTION_TIME_FOR_GRID_REFRESH || 55 * 60 * 1000; // 55 minutes
const YIELD_INTERVAL = 10;

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
      logText(`${this.jobName} stopping due to application shutdown`);
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
          logText(
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

const refreshGridsJob = async () => {
  const processor = new NonBlockingJobProcessor(JOB_NAME);

  try {
    processor.start();
    logText(`Starting ${JOB_NAME}...`);

    const allGrids = await GridModel("airqo")
      .find({})
      .select("_id")
      .lean();
    logText(`${JOB_NAME}: Found ${allGrids.length} grids to refresh.`);

    let totalProcessed = 0;

    const processGrid = async (grid) => {
      const mockRequest = {
        query: { tenant: "airqo" },
        params: { grid_id: grid._id.toString() },
      };
      const result = await gridUtil.refresh(mockRequest, (err) => {
        if (err) {
          logger.error(
            `Error in gridUtil.refresh callback for grid ${grid._id}: ${err.message}`
          );
        }
      });
      return result;
    };

    const batchResult = await processor.processBatch(allGrids, processGrid);

    totalProcessed += batchResult.processed;

    logText(
      `${JOB_NAME} completed: processed ${totalProcessed} grids in ${Date.now() -
        processor.startTime}ms`
    );
  } catch (error) {
    if (error.message.includes("stopped execution")) {
      logText(`${JOB_NAME} stopped gracefully`);
    } else {
      logger.error(`${JOB_NAME} error: ${error.message}`);
    }
  } finally {
    processor.end();
  }
};

const startJob = () => {
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    return;
  }
  try {
    const cronJobInstance = cron.schedule(JOB_SCHEDULE, refreshGridsJob, {
      scheduled: true,
      timezone: TIMEZONE,
    });

    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    global.cronJobs[JOB_NAME] = {
      job: cronJobInstance,
      name: JOB_NAME,
      schedule: JOB_SCHEDULE,
      stop: () => {
        logText(`Stopping ${JOB_NAME}...`);
        cronJobInstance.stop();
        delete global.cronJobs[JOB_NAME];
        logText(`${JOB_NAME} stopped.`);
      },
    };

    logText(`✅ ${JOB_NAME} started and scheduled.`);
  } catch (error) {
    logger.error(`Failed to initialize ${JOB_NAME}: ${error.message}`);
  }
};

startJob();

module.exports = {
  refreshGridsJob,
};
