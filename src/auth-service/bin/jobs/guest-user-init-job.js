const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/guest-user-init-job script`,
);

const ensureGuestUserExists = async () => {
  try {
    logger.info("Starting job: ensureGuestUserExists");

    // HOTFIX: Only run for airqo tenant to avoid permission errors
    // Other tenants require separate database credentials
    const tenant = "airqo";

    logger.info(`Creating guest user for tenant: ${tenant}`);

    try {
      // Check if guest user already exists in this tenant
      const existingGuestUser = await UserModel(tenant)
        .findById(constants.GUEST_USER_ID)
        .lean();

      if (existingGuestUser) {
        logger.info(
          `Guest user already exists in tenant '${tenant}' with ID: ${constants.GUEST_USER_ID.toString()}`,
        );
        logger.info("Finished job: ensureGuestUserExists");
        return;
      }

      // Create the sentinel guest user for this tenant
      logger.info(`Creating sentinel guest user in tenant '${tenant}'...`);

      const guestUser = {
        _id: constants.GUEST_USER_ID,
        email: "guest@airqo.system",
        userName: "guest_user",
        firstName: "Guest",
        lastName: "User",
        password:
          "$2b$10$DUMMY.HASH.FOR.GUEST.USER.THAT.CANNOT.BE.USED.TO.LOGIN",
        verified: false,
        isActive: false,
        analyticsVersion: 4,
        privilege: "guest",
        organization: tenant,
        long_organization: tenant,
        network_roles: [],
        group_roles: [],
        permissions: [],
      };

      await UserModel(tenant).create(guestUser);

      logger.info(
        `✅ Successfully created sentinel guest user in tenant '${tenant}' with ID: ${constants.GUEST_USER_ID.toString()}`,
      );
    } catch (error) {
      // Check if error is due to duplicate key (race condition)
      if (error.code === 11000) {
        logger.info(
          `Guest user already exists in tenant '${tenant}' (created by another instance/process)`,
        );
        return;
      }

      // Log authorization errors but don't crash the app
      if (error.message && error.message.includes("not authorized")) {
        logger.error(
          `❌ Authorization error for tenant '${tenant}': Database credentials do not have access. Skipping guest user creation.`,
        );
        return;
      }

      logger.error(
        `❌ Error creating guest user in tenant '${tenant}': ${error.message}`,
      );
    }

    logger.info("Finished job: ensureGuestUserExists");
  } catch (error) {
    logger.error(
      `❌ Error in ensureGuestUserExists job: ${error.message}`,
      error.stack,
    );
  }
};

module.exports = { ensureGuestUserExists };
