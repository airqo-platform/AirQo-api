const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/check-unassigned-sites-job`
);
const SitesModel = require("@models/Site");
const cron = require("node-cron");
const UNASSIGNED_THRESHOLD = 0;
const { logObject, logText } = require("@utils/shared");

const JOB_NAME = "check-unassigned-sites-job";
const JOB_SCHEDULE = "30 */2 * * *"; // At minute 30 of every 2nd hour

const checkUnassignedSites = async () => {
  try {
    // Count total number of active sites
    const totalCount = await SitesModel("airqo").countDocuments({
      isOnline: true,
    });

    // Find sites with empty or non-existent grids array
    const result = await SitesModel("airqo").aggregate([
      {
        $match: {
          isOnline: true,
          grids: { $size: 0 },
        },
      },
      {
        $group: {
          _id: "$generated_name",
        },
      },
    ]);

    const unassignedSiteCount = result.length;
    const uniqueSiteNames = result.map((site) => site._id);
    logObject("unassignedSiteCount", unassignedSiteCount);
    logObject("totalCount", totalCount);

    if (unassignedSiteCount === 0) {
      return;
    }

    const percentage = (unassignedSiteCount / totalCount) * 100;

    logObject("percentage", percentage);

    if (percentage > UNASSIGNED_THRESHOLD) {
      logText(
        `⚠️🙉 ${percentage.toFixed(
          2
        )}% of active sites are not assigned to any grid (${uniqueSiteNames.join(
          ", "
        )})`
      );
      logger.info(
        `⚠️🙉 ${percentage.toFixed(
          2
        )}% of active sites are not assigned to any grid (${uniqueSiteNames.join(
          ", "
        )})`
      );
    }
  } catch (error) {
    logText(`🐛🐛 Error checking unassigned sites: ${error.message}`);
    logger.error(`🐛🐛 Error checking unassigned sites: ${error.message}`);
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
};

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
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
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
    scheduled: true,
    timezone: constants.TIMEZONE,
  });

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      logText(`🛑 Stopping ${JOB_NAME}...`);
      cronJobInstance.stop();
      logText(`📅 ${JOB_NAME} schedule stopped.`);
      if (currentJobPromise) {
        await currentJobPromise;
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

// Start the job
startJob();
