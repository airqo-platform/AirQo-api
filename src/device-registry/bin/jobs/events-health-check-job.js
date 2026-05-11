// src/device-registry/bin/jobs/events-health-check-job.js
//
// Monitors the events data pipeline by checking whether the readings
// collection has received fresh data recently. A stale readings collection
// means either:
//   (a) the workflows microservice has stopped POSTing to /api/v2/devices/events, or
//   (b) the store-readings-job has stopped running / is failing.
//
// Both failure modes surface as "readings haven't been updated in > THRESHOLD hours"
// which is exactly what this job detects and reports to Slack via ops-alerts.

const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/events-health-check-job -- ops-alerts`,
);
const ReadingModel = require("@models/Reading");
const cron = require("node-cron");
const moment = require("moment-timezone");
const { logText } = require("@utils/shared");

const TIMEZONE = constants.TIMEZONE || "Africa/Kampala";
const THRESHOLD_HOURS = constants.EVENTS_STALENESS_THRESHOLD_HOURS;

const JOB_NAME = "events-health-check-job";
const JOB_SCHEDULE = "0 */2 * * *"; // Every 2 hours

async function checkEventsHealth() {
  try {
    // Fetch the single most-recent reading — lightweight index scan, no aggregation.
    const latestReading = await ReadingModel("airqo")
      .findOne({})
      .sort({ time: -1 })
      .select({ time: 1 })
      .lean();

    if (!latestReading) {
      logger.warn(
        `🚨 ${JOB_NAME}: readings collection is EMPTY for tenant=airqo` +
          ` — no events have ever been processed or the collection was dropped`,
      );
      return;
    }

    const latestTime = latestReading.time;
    if (!latestTime) {
      logger.warn(
        `🚨 ${JOB_NAME}: most recent reading has no 'time' field — data integrity issue`,
      );
      return;
    }

    const ageHours = moment().diff(moment(latestTime), "hours", true);
    const ageFormatted = ageHours.toFixed(1);
    const latestIso = moment(latestTime).toISOString();

    if (ageHours > THRESHOLD_HOURS) {
      logger.warn(
        `🚨 ${JOB_NAME}: events pipeline appears STALE` +
          ` — most recent reading is ${ageFormatted}h old (threshold: ${THRESHOLD_HOURS}h)` +
          ` | lastSeenAt=${latestIso}` +
          ` | ACTION: check workflows microservice pods and POST /api/v2/devices/events logs`,
      );
    } else {
      // Healthy — log at debug so it doesn't flood Slack.
      logger.debug(
        `${JOB_NAME}: pipeline healthy — most recent reading is ${ageFormatted}h old`,
      );
    }
  } catch (error) {
    logger.error(
      `🐛 ${JOB_NAME}: health check failed — ${error.message}`,
    );
  }
}

let isJobRunning = false;
let currentJobPromise = null;

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = checkEventsHealth();
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

const startJob = () => {
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
    scheduled: true,
    timezone: TIMEZONE,
  });

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      logText(`🛑 Stopping ${JOB_NAME}...`);
      cronJobInstance.stop();
      if (typeof cronJobInstance.destroy === "function") {
        cronJobInstance.destroy();
      }
      try {
        if (currentJobPromise) {
          await currentJobPromise;
        }
      } catch (e) {
        logger.error(
          `🐛🐛 Error while awaiting in-flight ${JOB_NAME} during stop: ${e.message}`,
        );
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  console.log(`✅ ${JOB_NAME} started — alerts if readings stale > ${THRESHOLD_HOURS}h`);
};

startJob();

module.exports = { checkEventsHealth };
