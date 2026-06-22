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
    app: {
      type: String,
      trim: true,
      set(value) {
        return value === "" ? undefined : value;
      },
      maxlength: [100, "app cannot exceed 100 characters"],
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
    screenshot_url: {
      type: String,
      trim: true,
      maxlength: [1000, "screenshot_url cannot exceed 1000 characters"],
    },
    // Optional freeform metadata for context (e.g. page URL, browser, app version).
    // Byte size is validated at the HTTP layer (see validators/users.validators.js).
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    // Computed at submission time: true if this feedback requires team action
    // (bugs, feature requests, performance issues, or substantive messages).
    // Drives the weekly reminder digest — pure rating/appreciation items are excluded.
    actionable: {
      type: Boolean,
      default: true,
    },
    // Internal notes visible only to admins — never exposed to the submitter.
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [2000, "adminNotes cannot exceed 2000 characters"],
    },
    // Tracks reminder digest state so the weekly job can skip recently-reminded items.
    reminderSentAt: {
      type: Date,
    },
    reminderCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Admin replies sent directly to the submitter from within the feedback item.
    replies: {
      type: [
        {
          message: {
            type: String,
            required: true,
            trim: true,
            maxlength: [5000, "Reply message cannot exceed 5000 characters"],
          },
          adminEmail: { type: String, trim: true, lowercase: true },
          adminId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
          sentAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    // Assignment — which admin user owns this item.
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    assignedAt: {
      type: Date,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    // Watchers receive notifications on status change and admin reply.
    watchers: {
      type: [
        {
          email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            validate: {
              validator: (v) => validator.isEmail(v),
              message: "{VALUE} is not a valid email address",
            },
          },
          name: { type: String, trim: true, maxlength: 100 },
          addedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

FeedbackSchema.index({ tenant: 1, createdAt: -1 });
FeedbackSchema.index({ tenant: 1, status: 1 });
FeedbackSchema.index({ tenant: 1, category: 1 });
FeedbackSchema.index({ tenant: 1, app: 1 });
FeedbackSchema.index({ email: 1, tenant: 1 });
// Supports the weekly reminder job query: actionable pending items per tenant
FeedbackSchema.index({ tenant: 1, actionable: 1, status: 1, createdAt: -1 });
// Supports assignment queries: all items assigned to a given admin
FeedbackSchema.index({ tenant: 1, assignedTo: 1, status: 1 });

FeedbackSchema.statics = {
  async register(args) {
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

  async list({ skip = 0, limit = 100, filter = {} } = {}) {
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

  async modify({ filter = {}, update = {} } = {}) {
    try {
      // runValidators ensures schema enum/min/max constraints are enforced on
      // updates, not just on inserts. context: 'query' is required for
      // validators that reference `this` in a query context.
      const options = { new: true, runValidators: true, context: "query" };

      // Whitelist: only pick fields that are intentionally mutable via this
      // path. Any other key in the incoming update object is silently ignored,
      // preventing accidental overwrites of email, subject, message, etc.
      const MUTABLE_FIELDS = [
        "status",
        "adminNotes",
        "reminderSentAt",
        "reminderCount",
        "assignedTo",
        "assignedAt",
        "assignedBy",
      ];
      const modifiedUpdate = {};
      for (const key of MUTABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(update, key)) {
          modifiedUpdate[key] = update[key];
        }
      }

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

  async addReply(filter = {}, reply = {}) {
    try {
      const options = { new: true, runValidators: true, context: "query" };
      const updatedFeedback = await this.findOneAndUpdate(
        filter,
        { $push: { replies: reply } },
        options,
      ).exec();

      if (!isEmpty(updatedFeedback)) {
        return createSuccessResponse("update", updatedFeedback._doc, "feedback");
      } else {
        return createNotFoundResponse("feedback", "update");
      }
    } catch (err) {
      return createErrorResponse(err, "update", logger, "feedback");
    }
  },

  // Used by the weekly reminder job to bump counters on batches of documents.
  async bulkUpdateReminderState(ids = [], sentAt = new Date()) {
    try {
      await this.updateMany(
        { _id: { $in: ids } },
        { $set: { reminderSentAt: sentAt }, $inc: { reminderCount: 1 } },
      );
    } catch (err) {
      logger.error(`bulkUpdateReminderState failed: ${err.message}`);
    }
  },

  async addWatcher(filter = {}, watcher = {}) {
    try {
      const options = { new: true, runValidators: true, context: "query" };
      // Combine the caller's filter with an atomic duplicate guard so the
      // read-check and write happen in a single round-trip, eliminating the
      // race condition from the previous two-step approach.
      const atomicFilter = {
        ...filter,
        "watchers.email": { $ne: watcher.email },
      };
      const updated = await this.findOneAndUpdate(
        atomicFilter,
        { $push: { watchers: watcher } },
        options,
      ).exec();
      if (!isEmpty(updated)) {
        return createSuccessResponse("update", updated._doc, "feedback");
      }
      // Distinguish "document not found" from "watcher already exists"
      const docExists = await this.exists(filter);
      if (docExists) {
        return {
          success: false,
          message: "This email is already watching the feedback item",
          status: httpStatus.CONFLICT,
          errors: { message: "Watcher already exists" },
        };
      }
      return createNotFoundResponse("feedback", "update");
    } catch (err) {
      return createErrorResponse(err, "update", logger, "feedback");
    }
  },

  async removeWatcher(filter = {}, email = "") {
    try {
      const options = { new: true };
      const updated = await this.findOneAndUpdate(
        filter,
        { $pull: { watchers: { email: email.toLowerCase().trim() } } },
        options,
      ).exec();
      if (!isEmpty(updated)) {
        return createSuccessResponse("update", updated._doc, "feedback");
      }
      return createNotFoundResponse("feedback", "update");
    } catch (err) {
      return createErrorResponse(err, "update", logger, "feedback");
    }
  },

  // Bulk status update: validates each transition individually and returns a
  // per-item success/failure report. Items with invalid transitions are skipped.
  async bulkModifyStatus(ids = [], requestedStatus = "", transitions = {}) {
    const succeeded = [];
    const failed = [];

    await Promise.all(
      ids.map(async (id) => {
        try {
          const existing = await this.findById(id).lean().exec();
          if (!existing) {
            failed.push({ id, reason: "Not found" });
            return;
          }
          const allowed = transitions[existing.status] || [];
          if (!allowed.includes(requestedStatus)) {
            failed.push({
              id,
              reason:
                allowed.length > 0
                  ? `Cannot transition "${existing.status}" → "${requestedStatus}". Allowed: ${allowed.join(", ")}`
                  : `"${existing.status}" is a terminal status`,
            });
            return;
          }
          // Include existing.status in the filter to detect concurrent status
          // changes — if another request modified the status between our read
          // and this write, findOneAndUpdate returns null and we report a failure
          // instead of silently bypassing the validated transition.
          const updated = await this.findOneAndUpdate(
            { _id: id, status: existing.status },
            { status: requestedStatus },
            { new: true, runValidators: true },
          ).exec();
          if (!updated) {
            failed.push({ id, reason: "Status changed concurrently — please retry" });
            return;
          }
          succeeded.push({
            id,
            previousStatus: existing.status,
            email: existing.email,
            subject: existing.subject,
            watchers: existing.watchers || [],
          });
        } catch (err) {
          failed.push({ id, reason: err.message });
        }
      }),
    );

    return { succeeded, failed };
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
      app: this.app,
      screenshot_url: this.screenshot_url,
      status: this.status,
      userId: this.userId,
      tenant: this.tenant,
      metadata: this.metadata,
      actionable: this.actionable,
      adminNotes: this.adminNotes,
      reminderSentAt: this.reminderSentAt,
      reminderCount: this.reminderCount,
      replies: this.replies,
      assignedTo: this.assignedTo,
      assignedAt: this.assignedAt,
      assignedBy: this.assignedBy,
      watchers: this.watchers,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

// Always delegate to getModelByTenant so every call is scoped to the correct
// tenant database. The try/catch pattern (mongoose.model global lookup) is
// removed because it could return a connection-agnostic model and bypass tenant
// isolation. getModelByTenant handles its own per-tenant caching internally via
// useDb({ useCache: true }), so repeated calls for the same tenant are cheap.
const FeedbackModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  return getModelByTenant(dbTenant, "feedback", FeedbackSchema);
};

module.exports = FeedbackModel;
