const RoleModel = require("@models/Role");
const UserModel = require("@models/User");
const MigrationTrackerModel = require("@models/MigrationTracker");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- rename-legacy-roles-migration`
);
const { connectToMongoDB } = require("@config/database");

const MIGRATION_NAME = "rename-legacy-group-roles-v1";

const LEASE_TTL_MS = parseInt(
  process.env.MIGRATION_LEASE_TTL_MS || `${30 * 60 * 1000}`,
  10
); // 30 min default
const leaseOwner = `${process.env.HOSTNAME || require("os").hostname()}#${
  process.pid
}`;

const runLegacyRoleMigration = async (tenant = "airqo") => {
  try {
    logger.info(`Starting migration: ${MIGRATION_NAME} for tenant: ${tenant}`);

    const tracker = await MigrationTrackerModel(tenant).findOne({
      name: MIGRATION_NAME,
      tenant,
    });

    if (tracker && tracker.status === "completed") {
      logger.info(
        `Migration '${MIGRATION_NAME}' has already been completed for tenant '${tenant}'. Skipping.`
      );
      return;
    }

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
      { upsert: true, new: true }
    );
    if (!lease || lease.status !== "running" || lease.tenant !== tenant) {
      logger.info(
        `Migration '${MIGRATION_NAME}' is already running for tenant '${tenant}'. Skipping.`
      );
      return;
    }

    const legacyRoles = await RoleModel(tenant).find({
      $or: [
        { role_name: { $regex: /_GROUP_/ } },
        { role_code: { $regex: /_GROUP_/ } },
      ],
    });

    if (legacyRoles.length === 0) {
      logger.info(
        "No legacy roles with '_GROUP_' found. Migration not needed."
      );
    } else {
      logger.info(`Found ${legacyRoles.length} legacy roles to process.`);
    }

    for (const legacyRole of legacyRoles) {
      const newRoleName = legacyRole.role_name.replace("_GROUP_", "_");
      const newRoleCode = legacyRole.role_code.replace("_GROUP_", "_");

      // Check for conflict based on the new role name, which is the unique field.
      // This correctly finds existing global roles like 'AIRQO_SUPER_ADMIN'.
      const conflictingRole = await RoleModel(tenant)
        .findOne({ role_name: newRoleName })
        .lean();

      if (conflictingRole) {
        // MERGE: A new-style role already exists.
        logger.warn(
          `Conflict found for ${legacyRole.role_name}. Merging into existing role ${conflictingRole.role_name}.`
        );

        // Use a single update with a pipeline to atomically migrate users,
        // preserve userType, and prevent creating duplicate roles.
        const updateResult = await UserModel(tenant).updateMany(
          { "group_roles.role": legacyRole._id },
          [
            {
              $set: {
                group_roles: {
                  $let: {
                    vars: {
                      kept: {
                        $filter: {
                          input: "$group_roles",
                          as: "gr",
                          cond: { $ne: ["$$gr.role", legacyRole._id] },
                        },
                      },
                      old: {
                        $first: {
                          $filter: {
                            input: "$group_roles",
                            as: "gr",
                            cond: { $eq: ["$$gr.role", legacyRole._id] },
                          },
                        },
                      },
                    },
                    in: {
                      $cond: [
                        {
                          $gt: [
                            {
                              $size: {
                                $filter: {
                                  input: "$$kept",
                                  as: "gr",
                                  cond: {
                                    $and: [
                                      {
                                        $eq: [
                                          "$$gr.group",
                                          legacyRole.group_id,
                                        ],
                                      },
                                      {
                                        $eq: ["$$gr.role", conflictingRole._id],
                                      },
                                    ],
                                  },
                                },
                              },
                            },
                            0,
                          ],
                        },
                        "$$kept",
                        {
                          $concatArrays: [
                            "$$kept",
                            [
                              {
                                group: legacyRole.group_id,
                                role: conflictingRole._id,
                                userType: {
                                  $ifNull: ["$$old.userType", "user"],
                                },
                              },
                            ],
                          ],
                        },
                      ],
                    },
                  },
                },
              },
            },
          ]
        );

        logger.info(
          `Migrated users from old role to new role. Matched: ${updateResult.matchedCount}, Modified: ${updateResult.modifiedCount}`
        );

        // 3. Delete the old, now-empty legacy role
        await RoleModel(tenant).deleteOne({ _id: legacyRole._id });
        logger.info(
          `Deleted redundant legacy role: ${legacyRole.role_name} (${legacyRole._id})`
        );
      } else {
        // RENAME: No conflict, just rename the role in-place.
        await RoleModel(tenant).updateOne(
          { _id: legacyRole._id },
          {
            $set: {
              role_name: newRoleName,
              role_code: newRoleCode,
            },
          }
        );
        logger.info(
          `Renamed legacy role '${legacyRole.role_name}' to '${newRoleName}'.`
        );
      }
    }

    await MigrationTrackerModel(tenant).updateOne(
      { name: MIGRATION_NAME, tenant },
      { $set: { status: "completed", completedAt: new Date() } }
    );

    logger.info(
      `Migration '${MIGRATION_NAME}' completed successfully for tenant '${tenant}'.`
    );
  } catch (error) {
    logger.error(
      `Migration '${MIGRATION_NAME}' failed: ${error.message}`,
      error
    );
    await MigrationTrackerModel(tenant).updateOne(
      { name: MIGRATION_NAME, tenant },
      { $set: { status: "failed", error: error.message } }
    );
  }
};

if (require.main === module) {
  (async () => {
    connectToMongoDB();
    // The auth-service is single-tenant ('airqo'), but the migration was
    // attempting to run for all tenants listed in constants, causing errors.
    const tenants = ["airqo"];
    try {
      const results = await Promise.allSettled(
        tenants.map((t) => runLegacyRoleMigration(t))
      );
      const failures = results.filter((r) => r.status === "rejected").length;
      process.exit(failures ? 1 : 0);
    } catch (err) {
      logger.error("Migration execution failed.", err);
      process.exit(1);
    }
  })();
}

module.exports = { runLegacyRoleMigration };
