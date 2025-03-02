const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const accessCodeGenerator = require("generate-password");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const { logObject, logText, HttpError } = require("@utils/shared");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- guest-user-model`
);

const GuestUserSchema = new Schema(
  {
    guest_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastActive: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);
GuestUserSchema.statics = {
  async register(args, next) {
    try {
      const guestId = accessCodeGenerator
        .generate(constants.RANDOM_PASSWORD_CONFIGURATION(16))
        .toUpperCase();

      const createdGuestUser = await this.create({
        guest_id: guestId,
        ...args,
      });

      if (!isEmpty(createdGuestUser)) {
        return {
          success: true,
          data: createdGuestUser,
          message: "guest user created",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          data: createdGuestUser,
          message:
            "Operation successful but guest user NOT successfully created",
          status: httpStatus.OK,
        };
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: err.message }
        )
      );
    }
  },
};
const GuestUserModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let users = mongoose.model("guest_users");
    return users;
  } catch (error) {
    let users = getModelByTenant(dbTenant, "guest_user", GuestUserSchema);
    return users;
  }
};

module.exports = GuestUserModel;
