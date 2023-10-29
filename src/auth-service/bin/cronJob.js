const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const inactiveThreshold = constants.INACTIVE_THRESHOLD || 2592000000; // 30 days
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/cronJob script`
);

// Everyday at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    await UserModel("airqo").updateMany(
      {
        $or: [
          {
            lastLogin: {
              $lt: new Date(Date.now() - inactiveThreshold),
            },
          },
          {
            lastLogin: null,
          },
        ],
      },
      {
        isActive: false,
      }
    );
  } catch (error) {
    logger.error(
      `An error occurred in the cron job --- ${JSON.stringify(error)}`
    );
  }
});
