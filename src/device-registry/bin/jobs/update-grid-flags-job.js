const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/update-grid-flags-job`
);
const GridModel = require("@models/Grid");
const cron = require("node-cron");
const { logObject, logText } = require("@utils/shared");

const JOB_NAME = "update-grid-flags-job";
const JOB_SCHEDULE = "0 */8 * * *"; // Every 8 hours

const updateGridFlags = async () => {
  try {
    logText(`Starting ${JOB_NAME}...`);

    const gridsToUpdate = await GridModel("airqo")
      .find({
        admin_level: "country",
        $or: [
          { flag_url: { $exists: false } },
          { flag_url: null },
          { flag_url: "" },
        ],
      })
      .lean();

    if (gridsToUpdate.length === 0) {
      logText("No country grids need flag URL updates.");
      return;
    }

    logObject("Grids to update", gridsToUpdate.length);

    const bulkOps = gridsToUpdate
      .map((grid) => {
        const flagUrl = constants.getFlagUrl(grid.name);
        if (flagUrl) {
          return {
            updateOne: {
              filter: { _id: grid._id },
              update: { $set: { flag_url: flagUrl } },
            },
          };
        }
        return null;
      })
      .filter(Boolean);

    if (bulkOps.length > 0) {
      const result = await GridModel("airqo").bulkWrite(bulkOps);
      logText(
        `Successfully updated flag_url for ${result.modifiedCount} grids.`
      );
    } else {
      logText("No flag URLs could be generated for the pending grids.");
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in ${JOB_NAME}: ${error.message}`);
  }
};

const startJob = () => {
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    logger.warn(`${JOB_NAME} already registered. Skipping duplicate start.`);
    return;
  }
  let isJobRunning = false;
  const cronJobInstance = cron.schedule(
    JOB_SCHEDULE,
    async () => {
      if (isJobRunning) {
        logger.warn(`${JOB_NAME} is already running, skipping this execution.`);
        return;
      }
      isJobRunning = true;
      try {
        await updateGridFlags();
      } catch (err) {
        logger.error(
          `🐛🐛 Error executing ${JOB_NAME}: ${err.stack || err.message}`
        );
      } finally {
        isJobRunning = false;
      }
    },
    { timezone: process.env.TZ || "Africa/Kampala" }
  );

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      if (cronJobInstance) {
        cronJobInstance.stop();
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started`);
};

startJob();

module.exports = {
  updateGridFlags,
};
