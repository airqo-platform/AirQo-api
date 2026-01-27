const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- daily-activity-summary-job`,
);
const ActivityLogModel = require("@models/ActivityLog");
const cron = require("node-cron");
const { logObject, logText } = require("@utils/shared");
const { LogThrottleManager } = require("@utils/common"); // Add LogThrottleManager
const moment = require("moment-timezone");

const TIMEZONE = moment.tz.guess();
const JOB_NAME = "daily-activity-summary-job";
const JOB_SCHEDULE = "0 8 * * *"; // At 8:00 AM every day

const LOG_TYPE = "daily-activity-summary"; // Define a log type for throttling
const logThrottleManager = new LogThrottleManager(); // Initialize LogThrottleManager

let isJobRunning = false;
let currentJobPromise = null;

const generateDailyActivitySummary = async () => {
  try {
    if (global.isShuttingDown) {
      logText(`${JOB_NAME} stopping due to application shutdown`);
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = moment(yesterday).format("YYYY-MM-DD");

    logText(`Generating daily activity summary for ${yesterdayStr}`);

    const filter = {
      day: yesterdayStr,
    };

    // Get daily statistics
    const statsResult = await ActivityLogModel("airqo").getDailyStats({
      filter,
    });

    if (
      !statsResult.success ||
      !statsResult.data ||
      statsResult.data.length === 0
    ) {
      logText(`No activity data found for ${yesterdayStr}`);
      return;
    }

    const dayStats = statsResult.data[0];
    const activities = dayStats.stats;

    // Calculate summary metrics
    let totalOperations = 0;
    let totalRecordsAttempted = 0;
    let totalRecordsSuccessful = 0;
    let totalRecordsFailed = 0;
    let successfulOperations = 0;
    let failedOperations = 0;
    let partialOperations = 0;

    const entityBreakdown = {};
    const operationBreakdown = {};

    activities.forEach((activity) => {
      totalOperations += activity.total_operations;
      totalRecordsAttempted += activity.total_records_attempted;
      totalRecordsSuccessful += activity.total_records_successful;
      totalRecordsFailed += activity.total_records_failed;

      if (activity.status === "SUCCESS") {
        successfulOperations += activity.total_operations;
      } else if (activity.status === "FAILURE") {
        failedOperations += activity.total_operations;
      } else if (activity.status === "PARTIAL_SUCCESS") {
        partialOperations += activity.total_operations;
      }

      // Entity breakdown
      if (!entityBreakdown[activity.entity_type]) {
        entityBreakdown[activity.entity_type] = {
          operations: 0,
          records_attempted: 0,
          records_successful: 0,
          records_failed: 0,
        };
      }
      entityBreakdown[activity.entity_type].operations +=
        activity.total_operations;
      entityBreakdown[activity.entity_type].records_attempted +=
        activity.total_records_attempted;
      entityBreakdown[activity.entity_type].records_successful +=
        activity.total_records_successful;
      entityBreakdown[activity.entity_type].records_failed +=
        activity.total_records_failed;

      // Operation breakdown
      if (!operationBreakdown[activity.operation_type]) {
        operationBreakdown[activity.operation_type] = {
          operations: 0,
          records_attempted: 0,
          records_successful: 0,
          records_failed: 0,
        };
      }
      operationBreakdown[activity.operation_type].operations +=
        activity.total_operations;
      operationBreakdown[activity.operation_type].records_attempted +=
        activity.total_records_attempted;
      operationBreakdown[activity.operation_type].records_successful +=
        activity.total_records_successful;
      operationBreakdown[activity.operation_type].records_failed +=
        activity.total_records_failed;
    });

    const successRate =
      totalOperations > 0
        ? ((successfulOperations / totalOperations) * 100).toFixed(2)
        : "0.00";

    const recordSuccessRate =
      totalRecordsAttempted > 0
        ? ((totalRecordsSuccessful / totalRecordsAttempted) * 100).toFixed(2)
        : "0.00";

    // Generate summary message
    const summaryMessage = `
📊 Daily API Activity Summary (${yesterdayStr})
==================================================
📈 Overall Metrics:
   • Total Operations: ${totalOperations}
   • Total Records Attempted: ${totalRecordsAttempted.toLocaleString()}
   • Total Records Successful: ${totalRecordsSuccessful.toLocaleString()}
   • Total Records Failed: ${totalRecordsFailed.toLocaleString()}

🎯 Success Rates:
   • Operation Success Rate: ${successRate}%
   • Record Success Rate: ${recordSuccessRate}%

📋 Operation Status Breakdown:
   • Successful Operations: ${successfulOperations}
   • Failed Operations: ${failedOperations}
   • Partially Successful: ${partialOperations}

🏗️ Entity Type Breakdown:
${Object.entries(entityBreakdown)
  .map(
    ([entity, stats]) =>
      `   • ${entity}: ${stats.operations} ops, ${stats.records_successful}/${stats.records_attempted} records`,
  )
  .join("\n")}

⚙️ Operation Type Breakdown:
${Object.entries(operationBreakdown)
  .map(
    ([operation, stats]) =>
      `   • ${operation}: ${stats.operations} ops, ${stats.records_successful}/${stats.records_attempted} records`,
  )
  .join("\n")}
    `;

    logText(summaryMessage);
    logger.info(summaryMessage);

    // If success rate is below threshold, log as warning
    if (parseFloat(successRate) < 90) {
      logger.warn(`⚠️ Low API success rate detected: ${successRate}%`);
    }

    if (parseFloat(recordSuccessRate) < 95) {
      logger.warn(`⚠️ Low record success rate detected: ${recordSuccessRate}%`);
    }
  } catch (error) {
    logger.error(
      `🐛🐛 ${JOB_NAME} Error generating daily summary: ${error.message}`,
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
};

const jobWrapper = async () => {
  // 1. Environment check: Only run in production
  if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") {
    return;
  }

  // 2. Distributed lock check: Prevent multiple instances from running concurrently
  try {
    const shouldRun = await logThrottleManager.shouldAllowLog(LOG_TYPE);
    if (!shouldRun) {
      return;
    }
  } catch (error) {
    logText(
      `Distributed lock check failed for ${JOB_NAME}: ${error.message}. Proceeding with local lock.`,
    );
  }

  // 3. Local lock check: Prevent overlapping executions within this process
  if (isJobRunning) {
    return;
  }

  isJobRunning = true;
  currentJobPromise = generateDailyActivitySummary(); // Call the core logic
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

const startDailyActivitySummaryJob = () => {
  try {
    // Prevent multiple schedules if the module is loaded multiple times
    if (global.cronJobs && global.cronJobs[JOB_NAME]) {
      logText(`${JOB_NAME} already scheduled, skipping re-initialization.`);
      return global.cronJobs[JOB_NAME];
    }

    const jobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
      scheduled: true,
      timezone: TIMEZONE,
    });

    if (!global.cronJobs) {
      global.cronJobs = {};
    }

    global.cronJobs[JOB_NAME] = {
      job: jobInstance,
      name: JOB_NAME,
      schedule: JOB_SCHEDULE,
      stop: async () => {
        logText(`🛑 Stopping ${JOB_NAME}...`);

        try {
          jobInstance.stop();
          logText(`📅 ${JOB_NAME} schedule stopped`);

          if (currentJobPromise) {
            logText(
              `⏳ Waiting for current ${JOB_NAME} execution to finish...`,
            );
            await currentJobPromise;
            logText(`✅ Current ${JOB_NAME} execution completed`);
          }
          delete global.cronJobs[JOB_NAME];
        } catch (error) {
          logger.error(`❌ Error stopping ${JOB_NAME}: ${error.message}`);
        }
      },
    };

    logText(`✅ ${JOB_NAME} registered and started (${JOB_SCHEDULE})`);
    return global.cronJobs[JOB_NAME];
  } catch (error) {
    logger.error(`❌ Failed to start ${JOB_NAME}: ${error.message}`);
    throw error;
  }
};

try {
  startDailyActivitySummaryJob();
  logText(`🎉 ${JOB_NAME} initialization complete`);
} catch (error) {
  logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  process.exit(1);
}

module.exports = {
  JOB_NAME,
  JOB_SCHEDULE,
  startDailyActivitySummaryJob,
  generateDailyActivitySummary,
  stopJob: async () => {
    if (global.cronJobs && global.cronJobs[JOB_NAME]) {
      await global.cronJobs[JOB_NAME].stop();
    }
  },
};
