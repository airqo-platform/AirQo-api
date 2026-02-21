const UserModel = require("@models/User");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/guest-user-init-job script`,
);

const GUEST_USER_ID = new mongoose.Types.ObjectId("000000000000000000000001");

const ensureGuestUserExists = async () => {
  try {
    logger.info("Starting job: ensureGuestUserExists");
    const tenant = (constants.DEFAULT_TENANT || "airqo").toLowerCase();

    // Check if guest user already exists
    const existingGuestUser = await UserModel(tenant)
      .findById(GUEST_USER_ID)
      .lean();

    if (existingGuestUser) {
      logger.info(
        `Guest user already exists with ID: ${GUEST_USER_ID.toString()}`,
      );
      return;
    }

    // Create the sentinel guest user
    logger.info("Creating sentinel guest user...");

    const guestUser = {
      _id: GUEST_USER_ID,
      email: "guest@airqo.system",
      userName: "guest_user",
      firstName: "Guest",
      lastName: "User",
      // Dummy password hash that can never be used for login
      password: "$2b$10$DUMMY.HASH.FOR.GUEST.USER.THAT.CANNOT.BE.USED.TO.LOGIN",
      verified: false,
      isActive: false,
      analyticsVersion: 4,
      privilege: "guest",
      organization: "airqo",
      long_organization: "airqo",
      network_roles: [],
      group_roles: [],
      permissions: [],
    };

    await UserModel(tenant).create(guestUser);

    logger.info(
      `✅ Successfully created sentinel guest user with ID: ${GUEST_USER_ID.toString()}`,
    );
  } catch (error) {
    // Check if error is due to duplicate key (race condition)
    if (error.code === 11000) {
      logger.info(
        "Guest user already exists (created by another instance/process)",
      );
      return;
    }

    logger.error(
      `❌ Error in ensureGuestUserExists job: ${error.message}`,
      error.stack,
    );
    // Don't throw - allow app to start even if guest user creation fails
  }
};

// Run immediately on app startup (not a cron job)
ensureGuestUserExists();

module.exports = { ensureGuestUserExists, GUEST_USER_ID };
