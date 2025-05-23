const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/incomplete-profile-job`
);
const {
  winstonLogger,
  mailer,
  stringify,
  date,
  msgs,
  emailTemplates,
  generateFilter,
  handleResponse,
} = require("@utils/common");

const checkStatus = async () => {
  try {
    const batchSize = 100;
    let skip = 0;

    while (true) {
      const users = await UserModel("airqo")
        .find({
          firstName: "Unknown",
          isActive: { $ne: false },
        })
        .limit(batchSize)
        .skip(skip)
        .select("_id email")
        .lean();

      if (users.length === 0) {
        break;
      }
      for (const user of users) {
        try {
          const emailResponse = await mailer.updateProfileReminder({
            email: user.email,
          });
          if (emailResponse && emailResponse.success === false) {
            logger.error(
              `🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`
            );
          }
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
global.cronJobs = global.cronJobs || {};
const schedule = "0 0 * * *"; // every day at midnight
const jobName = "incomplete-profile-job";
global.cronJobs[jobName] = cron.schedule(schedule, checkStatus, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
