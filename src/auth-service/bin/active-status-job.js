const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const inactiveThreshold = constants.INACTIVE_THRESHOLD || 2592000000; // 30 days
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/cronJob script`
);

const schedule =
  constants.ENVIRONMENT === "production" ? "0 17 * * *" : "0 0 * * *";

cron.schedule(
  schedule,
  async () => {
    try {
      const batchSize = 100; // Process 100 users at a time
      let skip = 0;

      while (true) {
        const users = await UserModel("airqo")
          .find({
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
            isActive: { $ne: false }, // Exclude users where isActive is false
          })
          .limit(batchSize)
          .skip(skip)
          .select("_id")
          .lean();

        if (users.length === 0) {
          break;
        }

        const userIds = users.map((user) => user._id);

        // Update users to set isActive: false
        await UserModel("airqo").updateMany(
          { _id: { $in: userIds } },
          { isActive: false }
        );

        skip += batchSize;
      }
    } catch (error) {
      logger.error(
        `An error occurred in the cron job --- ${JSON.stringify(error)}`
      );
    }
  },
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);
