require("module-alias/register");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- daily-compromise-summary-job`,
);
const cron = require("node-cron");
const CompromisedTokenLogModel = require("@models/CompromisedTokenLog");
const UserModel = require("@models/User"); // Import UserModel
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
              _id: "$_id", // Include the _id of the individual log entry
              ip: "$ip",
              tokenSuffix: "$tokenSuffix",
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

    const compromisedEmails = compromises.map((summary) => summary._id);
    const users = await UserModel(tenant)
      .find({ email: { $in: compromisedEmails } })
      .select("email firstName lastName")
      .lean();
    const userMap = new Map(users.map((user) => [user.email, user]));

    logText(
      `Found ${compromises.length} users with token compromises to notify.`,
    );

    const successfullyProcessedLogIds = [];

    for (const summary of compromises) {
      const email = summary._id;
      const { compromises: compromiseDetails, count } = summary;
      const user = userMap.get(email) || {}; // Get user details, default to empty object if not found

      try {
        const mailerResult = await mailer.sendCompromiseSummary({
          email,
          compromiseDetails,
          count,
          firstName: user.firstName, // Pass firstName
          lastName: user.lastName, // Pass lastName
          tenant: tenant, // Pass tenant inside params
        });

        if (mailerResult.success) {
          logText(`Compromise summary email sent to ${email}.`);
          // Collect the _id of each individual log entry that was part of this successful summary
          compromiseDetails.forEach((log) =>
            successfullyProcessedLogIds.push(log._id),
          );
        } else {
          logger.error(
            `Failed to send compromise summary to ${email}: ${
              mailerResult.message || "Unknown mailer error"
            }`,
          );
          if (mailerResult.errors) {
            logger.error(
              `Mailer errors: ${JSON.stringify(mailerResult.errors)}`,
            );
          }
        }
      } catch (error) {
        logger.error(
          `Failed to send compromise summary to ${email} (exception caught): ${error.message}`,
        );
      }
    }

    // Mark processed logs
    if (successfullyProcessedLogIds.length > 0) {
      await CompromisedTokenLogModel(tenant).updateMany(
        { _id: { $in: successfullyProcessedLogIds } },
        { $set: { processed: true } },
      );
      logText(
        `Marked ${successfullyProcessedLogIds.length} compromise logs as processed.`,
      );
    } else {
      logText("No compromise logs were successfully processed and marked.");
    }

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
