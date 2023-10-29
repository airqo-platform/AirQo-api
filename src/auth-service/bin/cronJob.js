const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const inactiveThreshold = constants.INACTIVE_THRESHOLD || 2592000000; //30 days
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/cronJob script`
);
// everyday at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    const inactiveUsers = await UserModel("airqo").find({
      lastLogin: { $lt: new Date(Date.now() - inactiveThreshold) },
      isActive: true,
    });

    if (inactiveUsers.length > 0) {
      await UserModel("airqo").updateMany(
        { _id: { $in: inactiveUsers.map((user) => user._id) }, isActive: true },
        { isActive: false }
      );
    }
  } catch (error) {
    logger.error(
      `An error occurred in the cron job --- ${JSON.stringify(error)}`
    );
  }
});
