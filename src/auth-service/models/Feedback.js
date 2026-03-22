const mongoose = require("mongoose");
const validator = require("validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- feedback-model`);
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const FEEDBACK_CATEGORIES = [
  "general",
  "bug",
  "feature_request",
  "performance",
  "ux_design",
  "other",
];

const FEEDBACK_STATUSES = ["pending", "reviewed", "resolved", "archived"];

const FEEDBACK_PLATFORMS = ["web", "mobile", "api"];

const FeedbackSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      lowercase: true,
      required: [true, "Email is required"],
      trim: true,
      validate: {
        validator(email) {
          return validator.isEmail(email);
        },
        message: "{VALUE} is not a valid email address",
      },
    },
    subject: {
      type: String,
      required: [true, "Subject is required"],
      trim: true,
      maxlength: [200, "Subject cannot exceed 200 characters"],
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [5000, "Message cannot exceed 5000 characters"],
    },
    rating: {
      type: Number,
      min: [1, "Rating must be between 1 and 5"],
      max: [5, "Rating must be between 1 and 5"],
    },
    category: {
      type: String,
      enum: {
        values: FEEDBACK_CATEGORIES,
        message: `Category must be one of: ${FEEDBACK_CATEGORIES.join(", ")}`,
      },
      default: "general",
    },
    platform: {
      type: String,
      enum: {
        values: FEEDBACK_PLATFORMS,
        message: `Platform must be one of: ${FEEDBACK_PLATFORMS.join(", ")}`,
      },
      default: "web",
    },
    status: {
      type: String,
      enum: {
        values: FEEDBACK_STATUSES,
        message: `Status must be one of: ${FEEDBACK_STATUSES.join(", ")}`,
      },
      default: "pending",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    tenant: {
      type: String,
      required: [true, "Tenant is required"],
      trim: true,
    },
    // Optional freeform metadata for context (e.g. page URL, browser, app version)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true },
);

FeedbackSchema.index({ tenant: 1, createdAt: -1 });
FeedbackSchema.index({ tenant: 1, status: 1 });
FeedbackSchema.index({ tenant: 1, category: 1 });
FeedbackSchema.index({ email: 1, tenant: 1 });

FeedbackSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({ ...args });
      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "feedback");
      } else {
        return createEmptySuccessResponse("feedback");
      }
    } catch (err) {
      return createErrorResponse(err, "create", logger, "feedback");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);
      const feedbacks = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();

      return {
        success: true,
        data: feedbacks,
        message: "successfully listed the feedback submissions",
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
      return createErrorResponse(err, "list", logger, "feedback");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = { ...update };

      // Status and tenant are the only mutable top-level fields for now
      delete modifiedUpdate.tenant;
      delete modifiedUpdate.email;

      const updatedFeedback = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options,
      ).exec();

      if (!isEmpty(updatedFeedback)) {
        return createSuccessResponse(
          "update",
          updatedFeedback._doc,
          "feedback",
        );
      } else {
        return createNotFoundResponse("feedback", "update");
      }
    } catch (err) {
      return createErrorResponse(err, "update", logger, "feedback");
    }
  },
};

FeedbackSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      email: this.email,
      subject: this.subject,
      message: this.message,
      rating: this.rating,
      category: this.category,
      platform: this.platform,
      status: this.status,
      userId: this.userId,
      tenant: this.tenant,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const FeedbackModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("feedbacks");
  } catch (error) {
    return getModelByTenant(dbTenant, "feedback", FeedbackSchema);
  }
};

module.exports = FeedbackModel;
