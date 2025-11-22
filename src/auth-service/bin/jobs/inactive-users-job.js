const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/inactive-users-job script`
);
const { mailer, stringify } = require("@utils/common");

const inactiveThresholdInDays = 45;
const reminderCooldownInDays = 90; // Don't send reminders more than once every 90 days

const sendInactivityReminders = async () => {
  try {
    logger.info("Starting job: sendInactivityReminders");
    const tenant = (constants.DEFAULT_TENANT || "airqo").toLowerCase();
    const now = new Date();
    const batchSize = 100;

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
        .limit(batchSize)
        .sort({ _id: 1 })
        .select("_id email firstName")
        .lean();

      if (inactiveUsers.length === 0) {
        logger.info("No more inactive users to process.");
        break;
      }

      for (const user of inactiveUsers) {
        try {
          await mailer.inactiveAccount({
            email: user.email,
            firstName: user.firstName,
          });
          await UserModel(tenant).findByIdAndUpdate(user._id, {
            last_inactive_reminder_sent_at: now,
          });
          logger.info(`Inactivity reminder sent to ${user.email}`);
        } catch (err) {
          logger.warn(
            `Failed processing inactivity reminder for ${
              user.email
            }: ${stringify(err)}`
          );
        }
      }
    }
    logger.info("Finished job: sendInactivityReminders");
  } catch (error) {
    logger.error(`Error in sendInactivityReminders job: ${stringify(error)}`);
  }
};

cron.schedule("0 2 * * *", sendInactivityReminders, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
