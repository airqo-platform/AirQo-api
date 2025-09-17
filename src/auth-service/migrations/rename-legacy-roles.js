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

const runLegacyRoleMigration = async (tenant = "airqo") => {
  try {
    logger.info(`Starting migration: ${MIGRATION_NAME} for tenant: ${tenant}`);

    const tracker = await MigrationTrackerModel(tenant).findOne({
      name: MIGRATION_NAME,
    });

    if (tracker && tracker.status === "completed") {
      logger.info(
        `Migration '${MIGRATION_NAME}' has already been completed for tenant '${tenant}'. Skipping.`
      );
      return;
    }

    await MigrationTrackerModel(tenant).findOneAndUpdate(
      { name: MIGRATION_NAME },
      { name: MIGRATION_NAME, status: "running", startedAt: new Date() },
      { upsert: true, new: true }
    );

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

      const conflictingRole = await RoleModel(tenant).findOne({
        role_code: newRoleCode,
        group_id: legacyRole.group_id,
      });

      if (conflictingRole) {
        // MERGE: A new-style role already exists.
        logger.warn(
          `Conflict found for ${legacyRole.role_name}. Merging into existing role ${conflictingRole.role_name}.`
        );

        // 1. Find users with the legacy role for this specific group
        const usersToMigrate = await UserModel(tenant).find({
          group_roles: {
            $elemMatch: { role: legacyRole._id },
          },
        });

        logger.info(
          `Found ${usersToMigrate.length} users to migrate for role ${legacyRole.role_name}.`
        );

        // 2. Update users in bulk
        if (usersToMigrate.length > 0) {
          const userIds = usersToMigrate.map((user) => user._id);
          // Atomically pull the old role and add the new one
          await UserModel(tenant).updateMany(
            { _id: { $in: userIds } },
            {
              $pull: { group_roles: { role: legacyRole._id } },
            }
          );
          await UserModel(tenant).updateMany(
            { _id: { $in: userIds } },
            {
              $addToSet: {
                group_roles: {
                  group: legacyRole.group_id,
                  role: conflictingRole._id,
                  userType: "user", // Assuming a default userType
                },
              },
            }
          );
          logger.info(
            `Migrated ${userIds.length} users from old role to new role.`
          );
        }

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
      { name: MIGRATION_NAME },
      { status: "completed", completedAt: new Date() }
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
      { name: MIGRATION_NAME },
      { status: "failed", error: error.message }
    );
  }
};

if (require.main === module) {
  // Connect to DB and run migration if script is executed directly
  connectToMongoDB();
  const tenants = constants.TENANTS || ["airqo"];
  for (const tenant of tenants) {
    runLegacyRoleMigration(tenant)
      .then(() => {
        logger.info(
          `Direct execution of migration for tenant ${tenant} finished.`
        );
        process.exit(0);
      })
      .catch((err) => {
        logger.error(
          `Direct execution of migration for tenant ${tenant} failed.`,
          err
        );
        process.exit(1);
      });
  }
}

module.exports = { runLegacyRoleMigration };
