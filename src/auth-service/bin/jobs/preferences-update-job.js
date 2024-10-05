const cron = require("node-cron");
const UserModel = require("@models/User");
const PreferenceModel = require("@models/Preference");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/preference-update-job`
);
const stringify = require("@utils/stringify");
const isEmpty = require("is-empty");

// Predefined array of 4 site IDs
const defaultSiteIds = constants.SELECTED_SITES;

const updatePreferences = async () => {
  try {
    const batchSize = 100;
    let skip = 0;

    while (true) {
      const users = await UserModel("airqo")
        .find()
        .limit(batchSize)
        .skip(skip)
        .select("_id")
        .lean();

      if (users.length === 0) {
        break;
      }

      for (const user of users) {
        try {
          const preference = await PreferenceModel("airqo")
            .findOne({
              user_id: user._id,
              selected_sites: { $exists: true, $eq: [] },
            })
            .lean();

          if (isEmpty(preference)) {
            // If no preference exists or selected_sites is not empty, create a new one
            const newPreference = {
              user_id: user._id,
              selected_sites: defaultSiteIds.map((siteId) => ({
                _id: siteId,
                createdAt: new Date(),
              })),
            };

            await PreferenceModel("airqo").create(newPreference);
            logger.info(`Created new preference for user ${user._id}`);
          } else {
            // If preference exists but selected_sites is empty, update it
            const updateResult = await PreferenceModel(
              "airqo"
            ).findOneAndUpdate(
              { _id: preference._id },
              {
                $set: {
                  selected_sites: defaultSiteIds.map((siteId) => ({
                    _id: siteId,
                    createdAt: new Date(),
                  })),
                },
              },
              { new: true }
            );

            logger.info(`Updated preference for user ${user._id}`);
          }
        } catch (error) {
          logger.error(
            `Failed to update preference for user ${user._id} --- ${stringify(
              error
            )}`
          );
        }
      }

      skip += batchSize;
    }
  } catch (error) {
    logger.error(`Internal Server Error --- ${stringify(error)}`);
  }
};

const schedule = "30 * * * *"; // At minute 30 of every hour
cron.schedule(schedule, updatePreferences, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
