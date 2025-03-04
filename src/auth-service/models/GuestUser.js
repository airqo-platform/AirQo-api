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
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
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
  async list({ filter = {}, limit = 100, skip = 0, next } = {}) {
    try {
      const guestUsers = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      if (!isEmpty(guestUsers)) {
        return {
          success: true,
          data: guestUsers,
          message: "successfully listed the guest users",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          data: [],
          message: "No guest users found",
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
  async modify({ filter = {}, update = {}, next } = {}) {
    try {
      let modifiedGuestUser = await this.findOneAndUpdate(filter, update, {
        new: true,
      }).exec();
      if (!isEmpty(modifiedGuestUser)) {
        return {
          success: true,
          data: modifiedGuestUser,
          message: "successfully modified the guest user",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "guest user not found",
          status: httpStatus.NOT_FOUND,
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
  async remove({ filter = {}, next } = {}) {
    try {
      let removedGuestUser = await this.findOneAndRemove(filter).exec();

      if (!isEmpty(removedGuestUser)) {
        return {
          success: true,
          data: removedGuestUser,
          message: "successfully removed the guest user",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "guest user not found",
          status: httpStatus.NOT_FOUND,
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
  async count({ filter = {}, next } = {}) {
    try {
      const total = await this.countDocuments(filter).exec();
      return {
        success: true,
        data: { total },
        message: "Successfully retrieved the total count of guest users",
        status: httpStatus.OK,
      };
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
  async findOne({ filter = {}, next } = {}) {
    try {
      const guestUser = await this.findOne(filter).exec();

      if (!isEmpty(guestUser)) {
        return {
          success: true,
          data: guestUser,
          message: "successfully retrieved the guest user",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "guest user not found",
          status: httpStatus.NOT_FOUND,
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
