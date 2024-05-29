const AccessTokenModel = require("@models/AccessToken");
const cron = require("node-cron");
const constants = require("@config/constants");
const mailer = require("@utils/mailer");
const stringify = require("@utils/stringify");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/token-expiration-job`
);
const moment = require("moment-timezone");

async function sendEmailsInBatches(tokens, batchSize = 100) {
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const emailPromises = batch.map((token) => {
      const email = token.email;
      const firstName = token.firstName;
      const lastName = token.lastName;
      return mailer
        .expiringToken({ email, firstName, lastName })
        .then((response) => {
          if (response && response.success === false) {
            logger.error(
              `Error sending email to ${email}: ${stringify(response)}`
            );
          }
        });
    });
    await Promise.all(emailPromises);
  }
}

cron.schedule(
  "0 0 1 * *",
  async () => {
    const timeZone = moment.tz.guess();
    const now = moment().tz(timeZone);
    const twoMonthsFromNow = now.clone().add(2, "months");
    const filter = {
      expires: { $gte: now.toDate(), $lt: twoMonthsFromNow.toDate() },
    };

    try {
      const tokens = await AccessTokenModel("airqo").list({ filter });
      await sendEmailsInBatches(tokens);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
    }
  },
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);
