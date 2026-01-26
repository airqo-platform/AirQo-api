require("module-alias/register");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- daily-compromise-summary-job`,
);
const cron = require("node-cron");
const CompromisedTokenLogModel = require("@models/CompromisedTokenLog");
const { mailer } = require("@utils/common");
const moment = require("moment-timezone");
const { logObject, logText } = require("@utils/shared");

const TIMEZONE = constants.TIMEZONE || "Africa/Kampala";
const JOB_NAME = "daily-compromise-summary-job";
const JOB_SCHEDULE = "0 8 * * *"; // At 8:00 AM every day

const generateAndSendSummaries = async (tenant = "airqo") => {
  try {
    if (constants.ENVIRONMENT !== "PRODUCTION ENVIRONMENT") {
      logger.info(
        `${JOB_NAME} is disabled for the ${constants.ENVIRONMENT} environment.`,
      );
      return;
    }

    const yesterday = moment().subtract(1, "day").toDate();

    const compromises = await CompromisedTokenLogModel(tenant).aggregate([
      { $match: { timestamp: { $gte: yesterday }, processed: false } },
      {
        $group: {
          _id: "$email",
          compromises: {
            $push: {
              ip: "$ip",
              token: "$token",
              timestamp: "$timestamp",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    if (compromises.length === 0) {
      logText(`No new token compromises to report for ${tenant}.`);
      return;
    }

    logText(
      `Found ${compromises.length} users with token compromises to notify.`,
    );

    for (const summary of compromises) {
      const email = summary._id;
      const { compromises: compromiseDetails, count } = summary;

      try {
        await mailer.sendCompromiseSummary(
          {
            email,
            compromiseDetails,
            count,
          },
          tenant,
        );
        logText(`Compromise summary email sent to ${email}.`);
      } catch (error) {
        logger.error(
          `Failed to send compromise summary to ${email}: ${error.message}`,
        );
      }
    }

    // Mark processed logs
    await CompromisedTokenLogModel(tenant).updateMany(
      { timestamp: { $gte: yesterday }, processed: false },
      { $set: { processed: true } },
    );

    logText("Finished processing daily compromise summaries.");
  } catch (error) {
    logger.error(
      `An error occurred during the daily compromise summary job: ${error.message}`,
    );
  }
};

const job = cron.schedule(
  JOB_SCHEDULE,
  async () => {
    try {
      await generateAndSendSummaries("airqo");
    } catch (error) {
      logger.error(
        `Error running daily compromise summary job: ${error.message}`,
      );
    }
  },
  {
    scheduled: true,
    timezone: TIMEZONE,
  },
);

if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
  job.start();
  logger.info(`✨ ${JOB_NAME} scheduled to run at ${JOB_SCHEDULE}`);
}

module.exports = {
  generateAndSendSummaries,
};
