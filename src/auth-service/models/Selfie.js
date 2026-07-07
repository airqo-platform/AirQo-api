const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} = require("@utils/shared");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- selfie-model`
);

function isTrustedCloudinarySelfieUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.includes("/clean_air_forum_selfies/")
    );
  } catch (error) {
    return false;
  }
}

const SelfieSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
      validate: {
        validator: isTrustedCloudinarySelfieUrl,
        message:
          "imageUrl must be an https://res.cloudinary.com/.../clean_air_forum_selfies/... URL",
      },
    },
    locationName: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    pm25Value: {
      type: Number,
      min: 0,
    },
    aqiCategory: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    avatarIcon: {
      type: String,
      trim: true,
      maxlength: 8,
    },
    guest_id: {
      type: String,
      trim: true,
      index: true,
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "user",
      index: true,
    },
    hidden: {
      type: Boolean,
      default: false,
      index: true,
    },
    hiddenAt: {
      type: Date,
    },
    hiddenBy: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
  },
  { timestamps: true }
);

SelfieSchema.index({ eventId: 1, hidden: 1, createdAt: -1 });

SelfieSchema.statics = {
  async register(args, next) {
    try {
      const createdSelfie = await this.create({ ...args });

      if (!isEmpty(createdSelfie)) {
        return createSuccessResponse("create", createdSelfie, "selfie", {
          message: "selfie submitted",
        });
      } else {
        return createErrorResponse(
          new Error("Operation successful but selfie NOT successfully created"),
          "create",
          logger,
          "selfie"
        );
      }
    } catch (err) {
      return createErrorResponse(err, "create", logger, "selfie");
    }
  },

  async list({ filter = {}, limit = 100, skip = 0, next } = {}) {
    try {
      const selfies = await this.aggregate()
        .match(filter)
        .project({
          user_id: 0,
          guest_id: 0,
          hiddenBy: 0,
          hiddenAt: 0,
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const totalCount = await this.countDocuments(filter);

      return {
        success: true,
        data: selfies,
        message: "successfully listed the selfies",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (err) {
      return createErrorResponse(err, "list", logger, "selfie");
    }
  },

  async modify({ filter = {}, update = {}, next } = {}) {
    try {
      if (isEmpty(filter)) {
        return createErrorResponse(
          new Error("A filter is required to update a selfie"),
          "update",
          logger,
          "selfie"
        );
      }
      const modifiedSelfie = await this.findOneAndUpdate(filter, update, {
        new: true,
      }).exec();

      if (!isEmpty(modifiedSelfie)) {
        return createSuccessResponse("update", modifiedSelfie, "selfie");
      } else {
        return createNotFoundResponse("selfie", "update", "selfie not found");
      }
    } catch (err) {
      return createErrorResponse(err, "update", logger, "selfie");
    }
  },

  async findOne({ filter = {}, next } = {}) {
    try {
      const selfie = await this.findOne(filter).exec();

      if (!isEmpty(selfie)) {
        return createSuccessResponse("find", selfie, "selfie", {
          message: "successfully retrieved the selfie",
        });
      } else {
        return createNotFoundResponse("selfie", "find", "selfie not found");
      }
    } catch (err) {
      return createErrorResponse(err, "find", logger, "selfie");
    }
  },

  async remove({ filter = {}, next } = {}) {
    try {
      const removedSelfie = await this.findOneAndRemove(filter).exec();

      if (!isEmpty(removedSelfie)) {
        return createSuccessResponse("delete", removedSelfie, "selfie");
      } else {
        return createNotFoundResponse("selfie", "delete", "selfie not found");
      }
    } catch (err) {
      return createErrorResponse(err, "delete", logger, "selfie");
    }
  },

  async removeMany({ filter = {}, next } = {}) {
    try {
      const result = await this.deleteMany(filter).exec();

      return {
        success: true,
        message: "successfully deleted stale selfies",
        data: { deletedCount: result.deletedCount },
        status: httpStatus.OK,
      };
    } catch (err) {
      return createErrorResponse(err, "delete", logger, "selfie");
    }
  },
};

const SelfieModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let selfies = mongoose.model("selfies");
    return selfies;
  } catch (error) {
    let selfies = getModelByTenant(dbTenant, "selfie", SelfieSchema);
    return selfies;
  }
};

module.exports = SelfieModel;
