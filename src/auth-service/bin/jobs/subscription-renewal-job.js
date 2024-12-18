// @utils/subscriptionRenewalUtils.js
const paddleClient = require("@config/paddle");
const TransactionModel = require("@models/Transaction");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const stringify = require("@utils/stringify");
const httpStatus = require("http-status");
const cron = require("node-cron");
const mailer = require("@utils/mailer");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- subscription-renewal-utils`
);

const subscriptionRenewalUtils = {
  /**
   * Automatically renew subscriptions and process transactions
   */
  processAutomaticRenewal: async () => {
    try {
      const batchSize = 100;
      let skip = 0;

      while (true) {
        // Find users eligible for automatic renewal
        const users = await UserModel("airqo")
          .find({
            subscriptionStatus: "active",
            isActive: true,
            automaticRenewal: true,
            nextBillingDate: { $lte: new Date() },
          })
          .limit(batchSize)
          .skip(skip)
          .select("_id email currentSubscriptionId currentPlanDetails")
          .lean();

        if (users.length === 0) break;

        for (const user of users) {
          try {
            // Fetch current subscription details
            const subscriptionDetails = await paddleClient.subscriptions.get(
              user.currentSubscriptionId
            );

            // Prepare transaction data
            const transactionData = {
              customerId: subscriptionDetails.customerId,
              items: [
                {
                  priceId: user.currentPlanDetails.priceId,
                  quantity: 1,
                },
              ],
              currency: user.currentPlanDetails.currency || "USD",
            };

            // Create renewal transaction
            const renewalTransaction = await paddleClient.transactions.create(
              transactionData
            );

            // Record transaction in local database
            const transactionRecord = await TransactionModel("airqo").register({
              paddle_transaction_id: renewalTransaction.id,
              paddle_event_type: "transaction.completed",
              user_id: user._id,
              paddle_customer_id: subscriptionDetails.customerId,
              amount: renewalTransaction.total,
              currency: transactionData.currency,
              status: "completed",
              payment_method: renewalTransaction.paymentMethod,
              items: transactionData.items,
              description: "Subscription Automatic Renewal",
              metadata: {
                subscriptionId: user.currentSubscriptionId,
                originalTransactionData: renewalTransaction,
              },
            });

            // Update user's next billing date
            const nextBillingDate = new Date();
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1); // Assuming monthly subscription

            await UserModel("airqo").findByIdAndUpdate(user._id, {
              $set: {
                nextBillingDate: nextBillingDate,
                lastRenewalDate: new Date(),
              },
            });

            // Send successful renewal notification
            await mailer.sendSubscriptionRenewalConfirmation({
              email: user.email,
              transactionId: renewalTransaction.id,
              amount: renewalTransaction.total,
              currency: transactionData.currency,
            });
          } catch (error) {
            // Handle renewal failure
            logger.error(
              `Automatic renewal failed for user ${user.email} --- ${stringify(
                error
              )}`
            );

            // Send failure notification
            await mailer.sendSubscriptionRenewalFailure({
              email: user.email,
              subscriptionId: user.currentSubscriptionId,
              errorMessage: error.message,
            });

            // Update user status if multiple renewal attempts fail
            await UserModel("airqo").findByIdAndUpdate(user._id, {
              $set: {
                subscriptionStatus: "past_due",
                automaticRenewal: false,
              },
            });
          }
        }

        skip += batchSize;
      }
    } catch (error) {
      logger.error(
        `Subscription renewal process error --- ${stringify(error)}`
      );
    }
  },

  /**
   * Notify users about upcoming renewals
   */
  sendUpcomingRenewalNotifications: async () => {
    try {
      const batchSize = 100;
      let skip = 0;

      // Find users with renewals in next 3 days
      const threeeDaysFromNow = new Date();
      threeeDaysFromNow.setDate(threeeDaysFromNow.getDate() + 3);

      while (true) {
        const users = await UserModel("airqo")
          .find({
            subscriptionStatus: "active",
            isActive: true,
            automaticRenewal: true,
            nextBillingDate: {
              $gte: new Date(),
              $lte: threeeDaysFromNow,
            },
          })
          .limit(batchSize)
          .skip(skip)
          .select("_id email nextBillingDate currentPlanDetails")
          .lean();

        if (users.length === 0) break;

        for (const user of users) {
          await mailer.sendUpcomingRenewalNotification({
            email: user.email,
            nextBillingDate: user.nextBillingDate,
            planDetails: user.currentPlanDetails,
          });
        }

        skip += batchSize;
      }
    } catch (error) {
      logger.error(
        `Upcoming renewal notifications error --- ${stringify(error)}`
      );
    }
  },
};

// Schedule jobs
const renewalSchedule = "0 2 * * *"; // every day at 2 AM
cron.schedule(
  renewalSchedule,
  subscriptionRenewalUtils.processAutomaticRenewal,
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);

const notificationSchedule = "0 9 * * *"; // every day at 9 AM
cron.schedule(
  notificationSchedule,
  subscriptionRenewalUtils.sendUpcomingRenewalNotifications,
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);

module.exports = subscriptionRenewalUtils;
