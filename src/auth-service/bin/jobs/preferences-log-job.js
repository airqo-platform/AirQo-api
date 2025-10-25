const cron = require("node-cron");
const mongoose = require("mongoose");
const UserModel = require("@models/User");
const PreferenceModel = require("@models/Preference");
const constants = require("@config/constants");
const log4js = require("log4js");
const { logText } = require("@utils/shared");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/preferences-log-job`
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
const isEmpty = require("is-empty");

const logUserPreferences = async () => {
  try {
    logText("Starting user preferences logging job...");
    const defaultGroupId = mongoose.Types.ObjectId(constants.DEFAULT_GROUP);

    // Use a single aggregation pipeline for efficiency
    const aggregation = [
      // Stage 1: Match users belonging to the default group
      {
        $match: {
          "group_roles.group": defaultGroupId,
        },
      },
      // Stage 2: Left join with preferences for the default group
      {
        $lookup: {
          from: "preferences",
          let: { userId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$user_id", "$$userId"] },
                    { $eq: ["$group_id", defaultGroupId] },
                  ],
                },
              },
            },
            { $project: { selected_sites: 1 } },
          ],
          as: "preference",
        },
      },
      // Stage 3: Unwind the preference array (or keep it empty if no match)
      {
        $unwind: {
          path: "$preference",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Stage 4: Group and count users
      {
        $group: {
          _id: null,
          totalUsersInGroup: { $sum: 1 },
          usersWithoutSelectedSites: {
            $sum: {
              $cond: [
                {
                  $or: [
                    { $not: ["$preference"] },
                    {
                      $eq: [
                        {
                          $size: {
                            $ifNull: ["$preference.selected_sites", []],
                          },
                        },
                        0,
                      ],
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ];

    const results = await UserModel("airqo").aggregate(aggregation).exec();

    if (results.length > 0) {
      const { totalUsersInGroup, usersWithoutSelectedSites } = results[0];
      const percentage = (
        (usersWithoutSelectedSites / totalUsersInGroup) *
        100
      ).toFixed(2);

      if (usersWithoutSelectedSites > 0) {
        logger.info(
          `💔💔 Users in default group without Customised Locations: ${usersWithoutSelectedSites}/${totalUsersInGroup} (${percentage}%)`
        );
      } else {
        logText(
          `😎🎉✅ All users in the default group have Customised Locations.`
        );
      }
    } else {
      logger.info(`🤔🤔 No users found in the default group.`);
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in logUserPreferences: ${stringify(error)}`);
  }
};

global.cronJobs = global.cronJobs || {};
const schedule = "30 */2 * * *"; // At minute 30 of every 2nd hour
const jobName = "preferences-log-job";
global.cronJobs[jobName] = cron.schedule(schedule, logUserPreferences, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

module.exports = { logUserPreferences };
