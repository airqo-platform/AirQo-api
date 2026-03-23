const GroupModel = require("@models/Group");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- default-group-init-job`,
);

// Canonical identifiers — stable across ALL environments (dev/staging/production).
// Never use _id for this purpose; it differs per environment.
const DEFAULT_AIRQO_GROUP_TITLE = "airqo";
const DEFAULT_AIRQO_GROUP_SLUG = "airqo";

/**
 * Ensures the default "airqo" group exists and is correctly configured.
 * Idempotent — safe to call on every application startup.
 *
 * Identification strategy: queries by grp_title (unique index) — never by _id.
 *
 * @param {string} tenant - Defaults to "airqo".
 * @returns {Promise<Object>} The verified or newly created group document.
 */
const ensureDefaultAirqoGroupExists = async (tenant = "airqo") => {
  try {
    const result = await GroupModel(tenant).findOneAndUpdate(
      { grp_title: DEFAULT_AIRQO_GROUP_TITLE },
      {
        // $set — applied on EVERY run to keep these fields in sync.
        $set: {
          organization_slug: DEFAULT_AIRQO_GROUP_SLUG,
          is_default: true,
          grp_status: "ACTIVE",
        },
        // $setOnInsert — written ONLY on first creation.
        // Preserves any manual admin edits to description on subsequent runs.
        $setOnInsert: {
          grp_title: DEFAULT_AIRQO_GROUP_TITLE,
          grp_description: "Default AirQo organization group",
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Distinguish created vs existing for the log message.
    const wasCreated =
      result.createdAt &&
      result.updatedAt &&
      Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 1000;

    logger.info(
      `✅ Default '${DEFAULT_AIRQO_GROUP_TITLE}' group successfully ${
        wasCreated ? "created" : "verified"
      } (id: ${result._id}).`,
    );

    return result;
  } catch (error) {
    logger.error(
      `🐛🐛 Error in ensureDefaultAirqoGroupExists: ${error.message}`,
    );
    // Re-throw so database.js handleDBInitialization can decide whether
    // a failed group init should halt application startup.
    throw error;
  }
};

module.exports = { ensureDefaultAirqoGroupExists };
