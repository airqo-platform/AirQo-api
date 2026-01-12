const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const { mailer, stringify } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/inactive-users-job script`
);

const inactiveThresholdInDays = 45;
const reminderCooldownInDays = 90; // Don't send reminders more than once every 90 days
const BATCH_SIZE = 100;
const CONCURRENCY_LIMIT = 10; // Number of emails to send in parallel

const sendInactivityReminders = async () => {
  try {
    logger.info("Starting job: sendInactivityReminders");
    const tenant = (constants.DEFAULT_TENANT || "airqo").toLowerCase();
    const now = new Date();

    const inactiveThresholdDate = new Date();
    inactiveThresholdDate.setDate(
      inactiveThresholdDate.getDate() - inactiveThresholdInDays
    );

    const reminderCooldownDate = new Date();
    reminderCooldownDate.setDate(
      reminderCooldownDate.getDate() - reminderCooldownInDays
    );

    while (true) {
      const inactiveUsers = await UserModel(tenant)
        .find({
          lastLogin: { $lt: inactiveThresholdDate },
          $or: [
            { last_inactive_reminder_sent_at: { $exists: false } },
            { last_inactive_reminder_sent_at: { $lt: reminderCooldownDate } },
          ],
        })
        .limit(BATCH_SIZE)
        .sort({ _id: 1 })
        .select("_id email firstName")
        .lean();

      if (inactiveUsers.length === 0) {
        logger.info("No more inactive users to process for this batch.");
        break;
      }

      const emailPromises = [];
      const successfulUserIds = [];

      for (const user of inactiveUsers) {
        emailPromises.push(
          mailer
            .inactiveAccount({
              email: user.email,
              firstName: user.firstName,
            })
            .then(() => {
              successfulUserIds.push(user._id);
              logger.info(
                `Successfully queued inactivity reminder for ${user.email}`
              );
              return { status: "fulfilled", email: user.email };
            })
            .catch((err) => {
              logger.warn(
                `Failed to send inactivity reminder to ${
                  user.email
                }: ${stringify(err)}`
              );
              return {
                status: "rejected",
                email: user.email,
                reason: err.message,
              };
            })
        );

        // Process in chunks to limit concurrency
        if (emailPromises.length >= CONCURRENCY_LIMIT) {
          await Promise.allSettled(emailPromises);
          emailPromises.length = 0; // Clear the array for the next chunk
        }
      }

      // Process any remaining promises
      if (emailPromises.length > 0) {
        await Promise.allSettled(emailPromises);
      }

      // Bulk update the users who received an email
      if (successfulUserIds.length > 0) {
        await UserModel(tenant).updateMany(
          { _id: { $in: successfulUserIds } },
          { $set: { last_inactive_reminder_sent_at: now } }
        );
        logger.info(
          `Updated 'last_inactive_reminder_sent_at' for ${successfulUserIds.length} users.`
        );
      }
    }
    logger.info("Finished job: sendInactivityReminders");
  } catch (error) {
    logger.error(`Error in sendInactivityReminders job: ${stringify(error)}`);
  }
};

if (constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT") {
  cron.schedule("0 2 * * *", sendInactivityReminders, {
    scheduled: true,
    timezone: "Africa/Nairobi",
  });
}
