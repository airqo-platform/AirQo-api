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

// Create and register the job
const startJob = () => {
  // Create the cron job instance 👇 THIS IS THE cronJobInstance!
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, checkUnassignedSites, {
    scheduled: true,
    timezone: constants.TIMEZONE,
  });

  // Initialize global registry
  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  // Register for cleanup 👇 USING cronJobInstance HERE!
  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      cronJobInstance.stop();
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

// Start the job
startJob();
