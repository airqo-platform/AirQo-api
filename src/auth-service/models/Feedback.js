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

// Single source of truth — defined in config/global/envs.js
const FEEDBACK_CATEGORIES = constants.FEEDBACK_CATEGORIES;
const FEEDBACK_STATUSES = constants.FEEDBACK_STATUSES;
const FEEDBACK_PLATFORMS = constants.FEEDBACK_PLATFORMS;

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
    // Optional freeform metadata for context (e.g. page URL, browser, app version).
    // Byte size is validated at the HTTP layer (see validators/users.validators.js).
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

  // Dedicated single-document lookup — avoids the countDocuments overhead
  // of list() when only one record is needed (used by getFeedbackSubmission).
  // Named findSingle to avoid shadowing Mongoose's built-in findOne.
  async findSingle(filter = {}) {
    try {
      const feedback = await this.findOne(filter).lean().exec();
      if (!isEmpty(feedback)) {
        return createSuccessResponse("get", feedback, "feedback");
      } else {
        return {
          success: false,
          message: "Feedback submission not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "No feedback found with that ID" },
        };
      }
    } catch (err) {
      return createErrorResponse(err, "get", logger, "feedback");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      // runValidators ensures schema enum/min/max constraints are enforced on
      // updates, not just on inserts. context: 'query' is required for
      // validators that reference `this` in a query context.
      const options = { new: true, runValidators: true, context: "query" };
      const modifiedUpdate = { ...update };

      // Immutable fields — silently strip to prevent accidental overwrite
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

// Use "feedback" (singular) consistently — matches the name getModelByTenant
// registers in the tenant DB, preventing a mismatch that could silently break
// model caching or tenant isolation.
const FeedbackModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("feedback");
  } catch (error) {
    return getModelByTenant(dbTenant, "feedback", FeedbackSchema);
  }
};

module.exports = FeedbackModel;
