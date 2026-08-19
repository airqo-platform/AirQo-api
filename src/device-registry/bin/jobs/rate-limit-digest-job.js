const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- rate-limit-digest-job -- ops-alerts`,
);
const RateLimitEventModel = require("@models/RateLimitEvent");
const cron = require("node-cron");
const { logText } = require("@utils/shared");
const { LogThrottleManager } = require("@utils/common");
const moment = require("moment-timezone");

const TIMEZONE = "Africa/Nairobi";
const JOB_NAME = "rate-limit-digest-job";
const JOB_SCHEDULE = "0 12 * * *"; // 12:00 PM EAT every day

const LOG_TYPE = "rate-limit-digest";
const logThrottleManager = new LogThrottleManager();

const TOP_OFFENDERS_LIMIT = 10;

let isJobRunning = false;
let currentJobPromise = null;

const generateRateLimitDigest = async () => {
  try {
    if (global.isShuttingDown) {
      logText(`${JOB_NAME} stopping due to application shutdown`);
      return;
    }

    const end = moment.tz(TIMEZONE).startOf("day");
    const start = end.clone().subtract(1, "day");
    const yesterdayStr = start.format("YYYY-MM-DD");

    logText(`Generating rate limit digest for ${yesterdayStr}`);

    const summary = await RateLimitEventModel("airqo").getSummary({
      start: start.toDate(),
      end: end.toDate(),
    });

    if (!summary || summary.length === 0) {
      logText(`No rate limit events found for ${yesterdayStr}`);
      return;
    }

    const totalTriggered = summary.reduce((sum, c) => sum + c.triggeredCount, 0);
    const totalBlocked = summary.reduce((sum, c) => sum + c.blockedCount, 0);
    const clientCount = summary.length;

    const topOffenders = summary.slice(0, TOP_OFFENDERS_LIMIT);

    const digestMessage = `
🚦 Rate Limit Digest (${yesterdayStr})
==================================================
📈 Overall:
   • Clients Rate-Limited: ${clientCount}
   • Rate Limit Triggers: ${totalTriggered}
   • Requests Blocked: ${totalBlocked}

🔝 Top Offenders:
${topOffenders
  .map(
    (c) =>
      `   • client=${c._id} | triggered=${c.triggeredCount} | blocked=${c.blockedCount} | peak qpm=${c.maxQpm || "n/a"}`,
  )
  .join("\n")}
    `;

    logText(digestMessage);
    logger.warn(digestMessage);
  } catch (error) {
    logger.error(
      `🐛🐛 ${JOB_NAME} Error generating rate limit digest: ${error.message}`,
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
};

const jobWrapper = async () => {
  if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") {
    return;
  }

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

  if (isJobRunning) {
    return;
  }

  isJobRunning = true;
  currentJobPromise = generateRateLimitDigest();
  try {
    await currentJobPromise;
  } catch (error) {
    logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

const startRateLimitDigestJob = () => {
  try {
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

    logText(`✅ ${JOB_NAME} registered and started (${JOB_SCHEDULE} ${TIMEZONE})`);
    return global.cronJobs[JOB_NAME];
  } catch (error) {
    logger.error(`❌ Failed to start ${JOB_NAME}: ${error.message}`);
    throw error;
  }
};

try {
  startRateLimitDigestJob();
  logText(`🎉 ${JOB_NAME} initialization complete`);
} catch (error) {
  logger.error(`💥 Failed to initialize ${JOB_NAME}: ${error.message}`);
  process.exit(1);
}

module.exports = {
  JOB_NAME,
  JOB_SCHEDULE,
  startRateLimitDigestJob,
  generateRateLimitDigest,
  stopJob: async () => {
    if (global.cronJobs && global.cronJobs[JOB_NAME]) {
      await global.cronJobs[JOB_NAME].stop();
    }
  },
};
