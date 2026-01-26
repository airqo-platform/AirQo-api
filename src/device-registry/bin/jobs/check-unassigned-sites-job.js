const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-unassigned-sites-job`,
);
const SitesModel = require("@models/Site");
const cron = require("node-cron");
const UNASSIGNED_THRESHOLD = 0;
const { logObject, logText } = require("@utils/shared");
const { LogThrottleManager, getSchedule } = require("@utils/common");
const moment = require("moment-timezone");

const JOB_NAME = "check-unassigned-sites-job";
const JOB_SCHEDULE = "30 */2 * * *"; // At minute 30 of every 2nd hour

const checkUnassignedSites = async () => {
  // Check if job should stop (for graceful shutdown)
  if (global.isShuttingDown) {
    logText(`${JOB_NAME} stopping due to application shutdown`);
    return;
  }

  // Restrict job to run only in production
  if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") {
    return;
  }

  try {
    // Use a single aggregation to get both total and unassigned counts
    const summaryResult = await SitesModel("airqo").aggregate([
      {
        $match: {
          isOnline: true,
        },
      },
      {
        $facet: {
          totalActiveSites: [{ $count: "count" }],
          unassignedSites: [
            {
              $match: {
                $or: [{ grids: { $exists: false } }, { grids: { $size: 0 } }],
              },
            },
            { $group: { _id: "$generated_name" } },
          ],
        },
      },
    ]);

    const summary = summaryResult[0];
    const totalCount = summary.totalActiveSites[0]
      ? summary.totalActiveSites[0].count
      : 0;
    const unassignedSites = summary.unassignedSites || [];
    const unassignedSiteCount = unassignedSites.length;
    const uniqueSiteNames = unassignedSites.map((site) => site._id);

    if (unassignedSiteCount === 0) {
      logText("No unassigned active sites found.");
      return;
    }

    const percentage = (unassignedSiteCount / totalCount) * 100;

    if (percentage > UNASSIGNED_THRESHOLD) {
      const message = `⚠️🙉 ${percentage.toFixed(
        2,
      )}% of active sites are not assigned to any grid (${uniqueSiteNames.join(
        ", ",
      )})`;
      logText(message);
      logger.info(message);
    }
  } catch (error) {
    logText(`🐛🐛 Error checking unassigned sites: ${error.message}`);
    logger.error(`🐛🐛 Error checking unassigned sites: ${error.message}`);
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
};

let isJobRunning = false;
let currentJobPromise = null;

const LOG_TYPE = "unassigned-sites-check";
const logThrottleManager = new LogThrottleManager();

const jobWrapper = async () => {
  try {
    const shouldRun = await logThrottleManager.shouldAllowLog(LOG_TYPE);
    if (!shouldRun) {
      logText(`Skipping ${JOB_NAME} execution to prevent duplicates.`);
      return;
    }
  } catch (error) {
    logText(
      `Distributed lock check failed: ${error.message}. Proceeding with execution.`,
    );
  }

  if (isJobRunning) {
    logText(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = checkUnassignedSites();
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

// Create and register the job
const startJob = () => {
  const cronJobInstance = cron.schedule(
    getSchedule(JOB_SCHEDULE, constants.ENVIRONMENT),
    jobWrapper,
    {
      scheduled: true,
      timezone: constants.TIMEZONE,
    },
  );

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    name: JOB_NAME,
    schedule: JOB_SCHEDULE,
    stop: async () => {
      logText(`🛑 Stopping ${JOB_NAME}...`);
      try {
        cronJobInstance.stop();
        logText(`📅 ${JOB_NAME} schedule stopped.`);
        if (currentJobPromise) {
          logText(`⏳ Waiting for current ${JOB_NAME} execution to finish...`);
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
};

// Start the job
startJob();

const handleShutdown = async (signal) => {
  logText(`Received ${signal}. Shutting down ${JOB_NAME} gracefully...`);
  global.isShuttingDown = true;
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    await global.cronJobs[JOB_NAME].stop();
  }
  logText(`${JOB_NAME} shutdown complete.`);
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));
