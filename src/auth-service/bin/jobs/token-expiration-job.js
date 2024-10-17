const AccessTokenModel = require("@models/AccessToken");
const cron = require("node-cron");
const constants = require("@config/constants");
const { logObject, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const stringify = require("@utils/stringify");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/token-expiration-job`
);

async function sendEmailsInBatches(tokens, batchSize = 100) {
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const emailPromises = batch.map((token) => {
      logObject("the expiring token", token);
      const {
        user: { email, firstName, lastName },
      } = token;

      logObject("the email to be used", email);
      return mailer
        .expiringToken({ email, firstName, lastName })
        .then((response) => {
          if (response && response.success === false) {
            logger.error(
              `🐛🐛 Error sending email to ${email}: ${stringify(response)}`
            );
          }
        });
    });
    await Promise.all(emailPromises);
  }
}

async function fetchAllExpiringTokens() {
  let allTokens = [];
  let skip = 0;
  const limit = 100;
  let hasMoreTokens = true;

  while (hasMoreTokens) {
    const tokensResponse = await AccessTokenModel("airqo").getExpiringTokens({
      skip,
      limit,
    });

    if (tokensResponse.success && tokensResponse.data.length > 0) {
      allTokens = allTokens.concat(tokensResponse.data);
      skip += limit; // Increment skip for the next batch
    } else {
      hasMoreTokens = false; // No more tokens to fetch
    }
  }
  return allTokens;
}

const sendAlertsForExpiringTokens = async () => {
  try {
    const tokens = await fetchAllExpiringTokens();
    if (tokens.length > 0) {
      await sendEmailsInBatches(tokens);
    } else {
      logger.info("No expiring tokens found for this month.");
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
  }
};

cron.schedule(
  "0 0 5 * *", // every 5th day of the month at midnight
  sendAlertsForExpiringTokens,
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);
