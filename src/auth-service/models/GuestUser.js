const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const accessCodeGenerator = require("generate-password");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");
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
      // Preserve guest_id generation logic
      const guestId = accessCodeGenerator
        .generate(constants.RANDOM_PASSWORD_CONFIGURATION(16))
        .toUpperCase();

      const createdGuestUser = await this.create({
        guest_id: guestId,
        ...args,
      });

      if (!isEmpty(createdGuestUser)) {
        return createSuccessResponse("create", createdGuestUser, "guest user", {
          message: "guest user created",
        });
      } else {
        return createEmptySuccessResponse(
          "guest user",
          "Operation successful but guest user NOT successfully created"
        );
      }
    } catch (err) {
      return createErrorResponse(err, "create", logger, "guest user");
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

      return createSuccessResponse("list", guestUsers, "guest user", {
        message: "successfully listed the guest users",
        emptyMessage: "No guest users found",
      });
    } catch (err) {
      return createErrorResponse(err, "list", logger, "guest user");
    }
  },

  async modify({ filter = {}, update = {}, next } = {}) {
    try {
      const modifiedGuestUser = await this.findOneAndUpdate(filter, update, {
        new: true,
      }).exec();

      if (!isEmpty(modifiedGuestUser)) {
        return createSuccessResponse("update", modifiedGuestUser, "guest user");
      } else {
        return createNotFoundResponse(
          "guest user",
          "update",
          "guest user not found"
        );
      }
    } catch (err) {
      return createErrorResponse(err, "update", logger, "guest user");
    }
  },

  async remove({ filter = {}, next } = {}) {
    try {
      const removedGuestUser = await this.findOneAndRemove(filter).exec();

      if (!isEmpty(removedGuestUser)) {
        return createSuccessResponse("delete", removedGuestUser, "guest user");
      } else {
        return createNotFoundResponse(
          "guest user",
          "delete",
          "guest user not found"
        );
      }
    } catch (err) {
      return createErrorResponse(err, "delete", logger, "guest user");
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
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: err.message },
      };
    }
  },

  async findOne({ filter = {}, next } = {}) {
    try {
      const guestUser = await this.findOne(filter).exec();

      if (!isEmpty(guestUser)) {
        return createSuccessResponse("find", guestUser, "guest user", {
          message: "successfully retrieved the guest user",
        });
      } else {
        return createNotFoundResponse(
          "guest user",
          "find",
          "guest user not found"
        );
      }
    } catch (err) {
      return createErrorResponse(err, "find", logger, "guest user");
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
