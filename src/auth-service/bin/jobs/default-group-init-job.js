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
// Tracks migration completion per-tenant so the Option C JWT guard is only
// activated for tenants whose migration has actually completed. A global boolean
// would incorrectly enable the guard for all tenants the moment any single
// tenant's migration finishes (e.g., activating the guard for "kcca" after
// "airqo" migration completes).
const _migrationCompleteByTenant = new Map();

const isGroupActivationMigrationComplete = (tenant = "airqo") =>
  _migrationCompleteByTenant.get(tenant) === true;

const activateAllExistingGroups = async (tenant = "airqo") => {
  try {
    // Atomically claim the migration slot for this tenant. Using a single
    // findOneAndUpdate with { status: { $ne: "completed" } } ensures two
    // replicas starting simultaneously cannot both run the migration:
    //
    //   • No existing doc  → upserts, returns null → this instance proceeds.
    //   • Existing "failed" doc → overwrites to "running", returns old doc
    //     with status "failed" → this instance proceeds (retry after crash).
    //   • Existing "running" doc → overwrites to "running", returns old doc
    //     with status "running" → another instance holds the claim, skip.
    //   • Existing "completed" doc → filter { $ne: "completed" } misses it;
    //     the upsert attempts to insert a second record, which throws E11000
    //     on the { name, tenant } unique index → caught below as "already done".
    let prior;
    try {
      prior = await MigrationTrackerModel(tenant).findOneAndUpdate(
        { name: ACTIVATION_MIGRATION_NAME, status: { $ne: "completed" } },
        {
          $set: { status: "running", startedAt: new Date(), tenant },
          $setOnInsert: { name: ACTIVATION_MIGRATION_NAME },
        },
        { upsert: true, new: false },
      );
    } catch (claimError) {
      if (claimError.code === 11000) {
        // Duplicate key on { name, tenant } unique index — a "completed" record
        // already exists. Migration was done on a previous deployment.
        logger.info(
          `✅ Migration '${ACTIVATION_MIGRATION_NAME}' already completed — skipping.`,
        );
        _migrationCompleteByTenant.set(tenant, true);
        return;
      }
      throw claimError;
    }

    if (prior?.status === "running") {
      // Another startup instance already claimed this migration — skip.
      logger.info(
        `⏭️  Migration '${ACTIVATION_MIGRATION_NAME}' is already running on another instance — skipping.`,
      );
      return;
    }

    // This instance holds the claim (prior is null = fresh insert, or
    // prior.status === "failed" = retrying after a previous crash).
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

    // Signal to the Option C guard — scoped to this tenant only.
    _migrationCompleteByTenant.set(tenant, true);
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

    // Non-fatal — startup continues. The tenant key stays absent from
    // _migrationCompleteByTenant so the Option C guard remains dormant for
    // this tenant until a subsequent restart successfully completes the migration.
  }
};

module.exports = {
  ensureDefaultAirqoGroupExists,
  activateAllExistingGroups,
  isGroupActivationMigrationComplete,
};
