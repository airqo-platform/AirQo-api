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

cron.schedule(
  "0 0 1 * *",
  async () => {
    const timeZone = moment.tz.guess();
    // Calculate the current date and time in the user's timezone
    const now = moment().tz(timeZone);
    // Calculate two months from now in the user's timezone
    const twoMonthsFromNow = now.clone().add(2, "months");
    const filter = {
      expires: { $gte: now.toDate(), $lt: twoMonthsFromNow.toDate() },
    };
    try {
      const tokens = await AccessTokenModel.list({ filter });
      tokens.forEach(async (token) => {
        const email = token.email;
        const firstName = token.firstName;
        const lastName = token.lastName;
        const emailResponse = await mailer.expiringToken({
          email,
          firstName,
          lastName,
        });

        if (emailResponse && emailResponse.success === false) {
          logger.error(
            `🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`
          );
        }
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
    }
  },
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);
