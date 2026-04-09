const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/guest-user-init-job script`,
);

const ensureGuestUserExists = async () => {
  try {
    // Use centralized DEFAULT_TENANT constant instead of hardcoded string
    const tenant = constants.DEFAULT_TENANT || "airqo";

    try {
      // Check if guest user already exists in this tenant
      const existingGuestUser = await UserModel(tenant)
        .findById(constants.GUEST_USER_ID)
        .lean();

      if (existingGuestUser) {
        return;
      }

      // Create the sentinel guest user for this tenant

      // Non-bcrypt sentinel password to prevent bcrypt.compare from being called
      const DUMMY_PASSWORD = "DUMMY_NON_BCRYPT_HASH";

      // Validation: Ensure the dummy password doesn't match bcrypt pattern
      // bcrypt hashes start with $2a$, $2b$, or $2y$
      if (
        DUMMY_PASSWORD.startsWith("$2") ||
        /^\$2[aby]\$/.test(DUMMY_PASSWORD)
      ) {
        throw new Error(
          "Guest user password must not match bcrypt hash pattern to prevent bcrypt.compare calls",
        );
      }

      const guestUser = {
        _id: constants.GUEST_USER_ID,
        email: "guest@airqo.system",
        userName: "guest_user",
        firstName: "Guest",
        lastName: "User",
        password: DUMMY_PASSWORD,
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
    } catch (error) {
      // Check if error is due to duplicate key (race condition)
      if (error.code === 11000) {
        return;
      }

      // Check for MongoDB authorization error (error code 13)
      if (error.code === 13) {
        logger.error(
          `❌ Authorization error for tenant '${tenant}': Database credentials do not have access. Skipping guest user creation.`,
        );
        return;
      }

      logger.error(
        `❌ Error creating guest user in tenant '${tenant}': ${error.message}`,
      );
      return;
    }
  } catch (error) {
    logger.error(
      `❌ Error in ensureGuestUserExists job: ${error.message}`,
      error.stack,
    );
  }
};

module.exports = { ensureGuestUserExists };
