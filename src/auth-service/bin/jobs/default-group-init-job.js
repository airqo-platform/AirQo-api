const GroupModel = require("@models/Group");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- default-group-init-job`,
);

/**
 * Ensures that the default 'airqo' group exists and is correctly configured.
 * This function is idempotent and safe to run on every application startup.
 * @param {string} tenant - The tenant to check, defaults to 'airqo'.
 */
const ensureDefaultAirqoGroupExists = async (tenant = "airqo") => {
  try {
    const groupData = {
      grp_title: "airqo",
      grp_description: "Default AirQo organization group",
      is_default: true,
    };

    // Use findOneAndUpdate with upsert to create the group if it doesn't exist,
    // or update it if it exists but is missing the is_default flag.
    const result = await GroupModel(tenant).findOneAndUpdate(
      { grp_title: "airqo" },
      { $set: groupData },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (result) {
      logger.info(`✅ Default 'airqo' group successfully verified/created.`);
    } else {
      logger.error(`❌ Failed to create or verify the default 'airqo' group.`);
    }
  } catch (error) {
    logger.error(
      `🐛🐛 Error in ensureDefaultAirqoGroupExists: ${error.message}`,
    );
  }
};

module.exports = { ensureDefaultAirqoGroupExists };
