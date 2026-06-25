const RoleModel = require("@models/Role");
const PermissionModel = require("@models/Permission");
const MigrationTrackerModel = require("@models/MigrationTracker");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- strip-system-permissions-migration`,
);
const os = require("os");

const MIGRATION_NAME = "strip-system-permissions-from-org-super-admin-v1";
const LEASE_TTL_MS = parseInt(
  process.env.MIGRATION_LEASE_TTL_MS || `${30 * 60 * 1000}`,
  10,
);
const leaseOwner = `${process.env.HOSTNAME || os.hostname()}#${process.pid}`;

/**
 * One-time migration: remove system-only permissions from all organization-level
 * _SUPER_ADMIN roles. These were incorrectly seeded from the AIRQO_SUPER_ADMIN
 * template, which contains platform-exclusive permissions that org roles must
 * never hold.
 *
 * Safe to call on every startup — exits in one findOne query once completed.
 */
const runStripSystemPermissionsMigration = async (tenant = "airqo") => {
  if (tenant !== "airqo") return;

  try {
    logger.info(
      `[${MIGRATION_NAME}] Checking migration status for tenant: ${tenant}`,
    );

    // Fast-exit: already done
    const existing = await MigrationTrackerModel(tenant).findOne({
      name: MIGRATION_NAME,
      tenant,
    });
    if (existing && existing.status === "completed") {
      logger.info(
        `[${MIGRATION_NAME}] Already completed — skipping.`,
      );
      return;
    }

    // Acquire distributed lease to prevent parallel runs across pods
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - LEASE_TTL_MS);
    const lease = await MigrationTrackerModel(tenant).findOneAndUpdate(
      {
        name: MIGRATION_NAME,
        tenant,
        $or: [
          { status: { $ne: "running" } },
          { status: "running", startedAt: { $lte: staleCutoff } },
        ],
      },
      {
        $set: { status: "running", startedAt: now, leaseOwner },
        $setOnInsert: { name: MIGRATION_NAME, tenant },
      },
      { upsert: true, new: true },
    );

    if (!lease || lease.leaseOwner !== leaseOwner) {
      logger.info(
        `[${MIGRATION_NAME}] Another instance owns the lease — skipping.`,
      );
      return;
    }

    // Resolve system-only permission document IDs once
    const systemPermNames = constants.SYSTEM_ONLY_PERMISSIONS || [];
    if (systemPermNames.length === 0) {
      logger.warn(
        `[${MIGRATION_NAME}] SYSTEM_ONLY_PERMISSIONS is empty — nothing to strip.`,
      );
      await _markCompleted(tenant, { rolesAffected: 0, permissionsStripped: 0 });
      return;
    }

    const systemPermDocs = await PermissionModel(tenant)
      .find({ permission: { $in: systemPermNames } })
      .select("_id permission")
      .lean();

    if (systemPermDocs.length === 0) {
      logger.info(
        `[${MIGRATION_NAME}] System permission documents not found in DB — no work needed.`,
      );
      await _markCompleted(tenant, { rolesAffected: 0, permissionsStripped: 0 });
      return;
    }

    const systemPermIds = systemPermDocs.map((p) => p._id);

    // Count affected org _SUPER_ADMIN roles before doing any writes
    const affectedCount = await RoleModel(tenant).countDocuments({
      role_name: { $not: /^AIRQO_/, $regex: /_SUPER_ADMIN$/ },
      role_permissions: { $in: systemPermIds },
    });

    if (affectedCount === 0) {
      logger.info(
        `[${MIGRATION_NAME}] No affected roles found — data is already clean.`,
      );
      await _markCompleted(tenant, { rolesAffected: 0, permissionsStripped: 0 });
      return;
    }

    logger.info(
      `[${MIGRATION_NAME}] Found ${affectedCount} org super admin role(s) with system permissions. Stripping...`,
    );

    // Single bulk write — strip all system permission IDs from all affected roles
    const result = await RoleModel(tenant).updateMany(
      {
        role_name: { $not: /^AIRQO_/, $regex: /_SUPER_ADMIN$/ },
        role_permissions: { $in: systemPermIds },
      },
      { $pull: { role_permissions: { $in: systemPermIds } } },
    );

    const permissionsStripped = systemPermIds.length * result.modifiedCount;
    logger.info(
      `[${MIGRATION_NAME}] Stripped system permissions from ${result.modifiedCount} role(s) ` +
        `(up to ${permissionsStripped} permission entries removed).`,
    );

    await _markCompleted(tenant, {
      rolesAffected: result.modifiedCount,
      permissionsStripped,
    });
  } catch (error) {
    logger.error(`[${MIGRATION_NAME}] Failed: ${error.message}`, error);
    await MigrationTrackerModel(tenant)
      .updateOne(
        { name: MIGRATION_NAME, tenant },
        { $set: { status: "failed", error: error.message } },
      )
      .catch(() => {});
  }
};

async function _markCompleted(tenant, stats) {
  await MigrationTrackerModel(tenant).updateOne(
    { name: MIGRATION_NAME, tenant },
    {
      $set: {
        status: "completed",
        completedAt: new Date(),
        ...stats,
      },
    },
  );
  logger.info(
    `[${MIGRATION_NAME}] Marked completed. Stats: ${JSON.stringify(stats)}`,
  );
}

module.exports = { runStripSystemPermissionsMigration };
