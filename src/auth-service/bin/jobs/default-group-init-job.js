const GroupModel = require("@models/Group");
const MigrationTrackerModel = require("@models/MigrationTracker");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- default-group-init-job`,
);

// Stable identifier for this one-time migration in MigrationTracker.
const ACTIVATION_MIGRATION_NAME = "activate-all-existing-groups-v1";

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

/**
 * One-time backward-compatibility migration — activates all groups that are
 * sitting at the schema default "INACTIVE" because they were created before
 * the activation concept existed.
 *
 * Safe to run on every startup (idempotent). Only touches groups that are
 * genuinely INACTIVE — it does NOT overwrite SUSPENDED / ARCHIVED / MAINTENANCE
 * groups that an admin has deliberately set to those states.
 *
 * MUST run before the Option C JWT guard is active; otherwise every existing
 * user loses their group permissions at the next token refresh.
 *
 * @param {string} tenant
 */
// Set to true once activateAllExistingGroups has run to completion.
// Read by the Option C guard in rbac.service.js to avoid filtering out
// groups during the window between server start and migration completion.
let _groupActivationMigrationComplete = false;

const isGroupActivationMigrationComplete = () =>
  _groupActivationMigrationComplete;

const activateAllExistingGroups = async (tenant = "airqo") => {
  try {
    // Check whether this migration has already been completed on a previous
    // deployment. If it has, skip immediately — this is a one-time migration
    // and must NOT re-run on subsequent startups because it would silently
    // activate any groups legitimately sitting in the INACTIVE review queue.
    const existing = await MigrationTrackerModel(tenant).findOne({
      name: ACTIVATION_MIGRATION_NAME,
    });

    if (existing?.status === "completed") {
      logger.info(
        `✅ Migration '${ACTIVATION_MIGRATION_NAME}' already completed on ${existing.completedAt?.toISOString()} — skipping.`,
      );
      _groupActivationMigrationComplete = true;
      return;
    }

    // Mark as running before touching data so a crash mid-migration is
    // visible in the tracker rather than silently lost.
    await MigrationTrackerModel(tenant).findOneAndUpdate(
      { name: ACTIVATION_MIGRATION_NAME },
      {
        $set: { status: "running", startedAt: new Date(), tenant },
        $setOnInsert: { name: ACTIVATION_MIGRATION_NAME },
      },
      { upsert: true },
    );

    const result = await GroupModel(tenant).updateMany(
      { grp_status: "INACTIVE" },
      { $set: { grp_status: "ACTIVE" } },
    );

    const count = result.modifiedCount ?? result.nModified ?? 0;

    // Record successful completion — subsequent startups will see this and skip.
    await MigrationTrackerModel(tenant).findOneAndUpdate(
      { name: ACTIVATION_MIGRATION_NAME },
      { $set: { status: "completed", completedAt: new Date() } },
    );

    logger.info(
      count > 0
        ? `✅ Migration '${ACTIVATION_MIGRATION_NAME}': activated ${count} pre-existing group(s).`
        : `✅ Migration '${ACTIVATION_MIGRATION_NAME}': no INACTIVE groups found — nothing to do.`,
    );

    // Signal to the Option C guard that migration is complete and the guard
    // can now safely enforce ACTIVE-only group permissions in JWTs.
    _groupActivationMigrationComplete = true;
  } catch (error) {
    logger.error(`🐛🐛 Error in activateAllExistingGroups: ${error.message}`);

    // Attempt to record the failure so it is visible in the tracker.
    try {
      await MigrationTrackerModel(tenant).findOneAndUpdate(
        { name: ACTIVATION_MIGRATION_NAME },
        { $set: { status: "failed", error: error.message } },
      );
    } catch (_) {
      // Ignore — tracker write failure is not worth surfacing on top of the
      // original error.
    }

    // Non-fatal — startup continues. _groupActivationMigrationComplete stays
    // false so the Option C guard remains dormant until a subsequent restart
    // successfully completes the migration.
  }
};

module.exports = {
  ensureDefaultAirqoGroupExists,
  activateAllExistingGroups,
  isGroupActivationMigrationComplete,
};
