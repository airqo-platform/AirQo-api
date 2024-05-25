const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/incomplete-profile-job`
);
const stringify = require("@utils/stringify");
const mailer = require("@utils/mailer");

const checkStatus = async () => {
  try {
    const batchSize = 100; // Process 100 users at a time
    let skip = 0;

    while (true) {
      const users = await UserModel("airqo")
        .find({
          firstName: "Unknown", // Find users with firstName "Unknown"
          isActive: { $ne: false }, // Exclude users where isActive is false
        })
        .limit(batchSize)
        .skip(skip)
        .select("_id email") // Select _id and email for sending the email
        .lean();

      if (users.length === 0) {
        break;
      }

      // Iterate over each user and send an email reminder
      for (const user of users) {
        try {
          const responseFromSendEmail = await mailer.updateProfileReminder(
            { email: user.email },
            next
          );
          logger.info(`Email sent to ${user.email} for updating firstName.`);
        } catch (error) {
          logger.error(
            `Failed to send email to ${user.email} --- ${stringify(error)}`
          );
        }
      }

      skip += batchSize;
    }
  } catch (error) {
    logger.error(`Internal Server Error --- ${stringify(error)}`);
  }
};

const schedule = "0 0 * * *"; // Schedule to run once every day at midnight
cron.schedule(schedule, checkStatus, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
