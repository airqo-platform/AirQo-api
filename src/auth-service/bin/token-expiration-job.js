const AccessTokenModel = require("@models/AccessToken");
const cron = require("node-cron");
const constants = require("@config/constants");
const mailer = require("@utils/mailer");
const stringify = require("@utils/stringify");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/token-expiration`
);

cron.schedule("0 0 1 * *", async () => {
  // Find tokens expiring within the next 2 months
  const now = new Date();
  const twoMonthsFromNow = new Date(now.setMonth(now.getMonth() + 2));
  const filter = {
    expires: { $gte: now, $lt: twoMonthsFromNow },
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
});
