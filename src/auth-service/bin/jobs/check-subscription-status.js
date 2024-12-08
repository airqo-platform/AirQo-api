// @utils/subscriptionUtils.js
const paddleClient = require("@config/paddle");
const TransactionModel = require("@models/Transaction");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const stringify = require("@utils/stringify");
const httpStatus = require("http-status");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- subscription-utils`
);

const checkSubscriptionStatuses = async () => {
  try {
    const batchSize = 100;
    let skip = 0;

    while (true) {
      // Find users with active subscriptions
      const users = await UserModel("airqo")
        .find({
          subscriptionStatus: "active",
          isActive: true,
        })
        .limit(batchSize)
        .skip(skip)
        .select("_id email currentSubscriptionId")
        .lean();

      if (users.length === 0) break;

      for (const user of users) {
        try {
          // Fetch subscription status from Paddle
          const subscriptionStatus = await paddleClient.subscriptions.get(
            user.currentSubscriptionId
          );

          // Update local user record based on Paddle subscription status
          await UserModel("airqo").findByIdAndUpdate(user._id, {
            $set: {
              subscriptionStatus: subscriptionStatus.status,
              lastSubscriptionCheck: new Date(),
            },
          });

          // Log significant status changes or actions needed
          if (subscriptionStatus.status === "past_due") {
            // Send reminder email or notification
            await mailer.sendSubscriptionReminderEmail({
              email: user.email,
              subscriptionId: user.currentSubscriptionId,
            });
          }
        } catch (error) {
          logger.error(
            `Failed to check subscription for user ${
              user.email
            } --- ${stringify(error)}`
          );
        }
      }

      skip += batchSize;
    }
  } catch (error) {
    logger.error(`Subscription status check error --- ${stringify(error)}`);
  }
};

// Schedule the subscription status check job
const schedule = "0 1 * * *"; // every day at 1 AM
cron.schedule(schedule, checkSubscriptionStatuses, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

module.exports = subscriptionUtils;
