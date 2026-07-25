const AccessTokenModel = require("@models/AccessToken");
const cron = require("node-cron");
const constants = require("@config/constants");
const { logObject, logText } = require("@utils/shared");
const { mailer, stringify } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/token-expiration-job -- ops-alerts`,
);

// Days-before-expiry at which a reminder email goes out, e.g. [5, 2] sends
// one email when a token has 5 days left and a separate one at 2 days left.
const REMINDER_DAY_THRESHOLDS = constants.TOKEN_EXPIRY_REMINDER_DAY_THRESHOLDS || [
  5,
  2,
];
// Sorted descending so each threshold's query can be bounded below by the
// next-smaller threshold, carving out non-overlapping bands (e.g. "2 to 5
// days out", then "0 to 2 days out") — otherwise a token could match more
// than one threshold's query in the same run and get two reminders at once.
const SORTED_DESC_THRESHOLDS = [...REMINDER_DAY_THRESHOLDS].sort(
  (a, b) => b - a,
);
const minDaysFor = (days) => {
  const index = SORTED_DESC_THRESHOLDS.indexOf(days);
  const nextSmaller = SORTED_DESC_THRESHOLDS[index + 1];
  return nextSmaller !== undefined ? nextSmaller : 0;
};

async function sendEmailsInBatches(tokens, days, batchSize = 100) {
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const emailPromises = batch.map(async (token) => {
      logObject("the expiring token", token);
      const {
        _id,
        user: { email, firstName, lastName },
        token: tokenValue,
        name: tokenName,
        expires,
      } = token;

      // Scope the cooldown by token id + expiry date + threshold so: (a) this
      // reminder doesn't collide with the other threshold's reminder for the
      // same token, (b) it doesn't collide with a different token's reminder
      // for the same owner, and (c) a renewed/re-expiring token starts a
      // fresh reminder cycle instead of being suppressed by a stale cooldown.
      // Uses the token document's _id rather than any fragment of the secret
      // token value, so no part of the secret ever ends up in a log/cache key.
      const expiryDay = new Date(expires).toISOString().slice(0, 10);
      const cooldownKey = `${_id}:${expiryDay}:${days}d`;

      try {
        const response = await mailer.expiringToken({
          email,
          firstName,
          lastName,
          token: tokenValue,
          tokenName,
          expires,
          daysRemaining: days,
          cooldownKey,
        });
        if (response && response.success === false) {
          logger.error(
            `🐛🐛 Error sending ${days}-day expiry reminder to ${email}: ${stringify(
              response,
            )}`,
          );
        }
      } catch (error) {
        logger.error(
          `🐛🐛 Error sending ${days}-day expiry reminder to ${email}: ${error.message}`,
        );
      }
    });
    await Promise.all(emailPromises);
  }
}

async function fetchTokensExpiringWithinDays(days) {
  let allTokens = [];
  let skip = 0;
  const limit = 100;
  let hasMoreTokens = true;
  const minDays = minDaysFor(days);

  while (hasMoreTokens) {
    const tokensResponse = await AccessTokenModel("airqo").getExpiringTokens({
      skip,
      limit,
      days,
      minDays,
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
  for (const days of REMINDER_DAY_THRESHOLDS) {
    try {
      const tokens = await fetchTokensExpiringWithinDays(days);
      if (tokens.length > 0) {
        await sendEmailsInBatches(tokens, days);
      } else {
        logText(`No tokens expiring within ${days} day(s) found today.`);
      }
    } catch (error) {
      logger.error(
        `🐛🐛 Internal Server Error -- ${days}-day expiry reminder sweep -- ${stringify(
          error,
        )}`,
      );
    }
  }
};

global.cronJobs = global.cronJobs || {};
const jobName = "token-expiration-job";
global.cronJobs[jobName] = cron.schedule(
  "0 8 * * *", // every day at 08:00
  sendAlertsForExpiringTokens,
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  },
);

module.exports = {
  sendAlertsForExpiringTokens,
  fetchTokensExpiringWithinDays,
  REMINDER_DAY_THRESHOLDS,
};
