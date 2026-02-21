const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/guest-user-init-job script`,
);

const ensureGuestUserExists = async () => {
  try {
    logger.info("Starting job: ensureGuestUserExists");

    // Get list of all tenants from constants
    // This respects your existing tenant configuration
    const tenants = constants.TENANTS || [
      (constants.DEFAULT_TENANT || "airqo").toLowerCase(),
    ];

    logger.info(
      `Creating guest user for ${tenants.length} tenant(s): ${tenants.join(", ")}`,
    );

    // Create guest user in each tenant
    for (const tenant of tenants) {
      try {
        const tenantLower = tenant.toLowerCase();

        // Check if guest user already exists in this tenant
        const existingGuestUser = await UserModel(tenantLower)
          .findById(constants.GUEST_USER_ID)
          .lean();

        if (existingGuestUser) {
          logger.info(
            `Guest user already exists in tenant '${tenantLower}' with ID: ${constants.GUEST_USER_ID.toString()}`,
          );
          continue; // Skip to next tenant
        }

        // Create the sentinel guest user for this tenant
        logger.info(
          `Creating sentinel guest user in tenant '${tenantLower}'...`,
        );

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
          organization: tenantLower,
          long_organization: tenantLower,
          network_roles: [],
          group_roles: [],
          permissions: [],
        };

        await UserModel(tenantLower).create(guestUser);

        logger.info(
          `✅ Successfully created sentinel guest user in tenant '${tenantLower}' with ID: ${constants.GUEST_USER_ID.toString()}`,
        );
      } catch (error) {
        // Check if error is due to duplicate key (race condition)
        if (error.code === 11000) {
          logger.info(
            `Guest user already exists in tenant '${tenant}' (created by another instance/process)`,
          );
          continue;
        }

        logger.error(
          `❌ Error creating guest user in tenant '${tenant}': ${error.message}`,
        );
        // Continue to next tenant instead of failing the entire job
      }
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
