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
    const batchSize = 100;
    let skip = 0;

    const inactiveThresholdDate = new Date();
    inactiveThresholdDate.setDate(
      inactiveThresholdDate.getDate() - inactiveThresholdInDays
    );

    const reminderCooldownDate = new Date();
    reminderCooldownDate.setDate(
      reminderCooldownDate.getDate() - reminderCooldownInDays
    );

    while (true) {
      const inactiveUsers = await UserModel("airqo")
        .find({
          lastLogin: { $lt: inactiveThresholdDate },
          isActive: true, // Only target active users
          $or: [
            { last_inactive_reminder_sent_at: { $exists: false } },
            { last_inactive_reminder_sent_at: { $lt: reminderCooldownDate } },
          ],
        })
        .limit(batchSize)
        .skip(skip)
        .select("_id email firstName")
        .lean();

      if (inactiveUsers.length === 0) {
        logger.info("No more inactive users to process.");
        break;
      }

      for (const user of inactiveUsers) {
        await mailer.inactiveAccount({
          email: user.email,
          firstName: user.firstName,
        });
        await UserModel("airqo").findByIdAndUpdate(user._id, {
          last_inactive_reminder_sent_at: new Date(),
        });
        logger.info(`Inactivity reminder sent to ${user.email}`);
      }

      skip += batchSize;
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
