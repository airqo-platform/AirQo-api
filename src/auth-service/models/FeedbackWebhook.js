const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- feedback-webhook-model`,
);
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const WEBHOOK_EVENTS = [
  "feedback.submitted",
  "feedback.status_changed",
  "feedback.reply_added",
  "feedback.assigned",
  "feedback.bulk_status_changed",
  "feedback.watcher_added",
];

const FeedbackWebhookSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
      maxlength: [100, "name cannot exceed 100 characters"],
    },
    url: {
      type: String,
      required: [true, "url is required"],
      trim: true,
      maxlength: [2000, "url cannot exceed 2000 characters"],
      validate: {
        validator(v) {
          try {
            return new URL(v).protocol === "https:";
          } catch {
            return false;
          }
        },
        message: "url must be a valid HTTPS URL",
      },
    },
    // Subset of WEBHOOK_EVENTS this webhook subscribes to.
    events: {
      type: [String],
      enum: {
        values: WEBHOOK_EVENTS,
        message: `events must be one of: ${WEBHOOK_EVENTS.join(", ")}`,
      },
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "at least one event is required",
      },
    },
    // HMAC-SHA256 signing secret — used to generate X-AirQo-Signature header.
    secret: {
      type: String,
      required: [true, "secret is required"],
      trim: true,
      minlength: [16, "secret must be at least 16 characters"],
    },
    active: {
      type: Boolean,
      default: true,
    },
    tenant: {
      type: String,
      required: [true, "tenant is required"],
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
  },
  { timestamps: true },
);

FeedbackWebhookSchema.index({ tenant: 1, active: 1 });
FeedbackWebhookSchema.index({ tenant: 1, events: 1, active: 1 });

FeedbackWebhookSchema.statics = {
  async register(args) {
    try {
      const data = await this.create({ ...args });
      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "webhook");
      }
      return createEmptySuccessResponse("webhook");
    } catch (err) {
      return createErrorResponse(err, "create", logger, "webhook");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const totalCount = await this.countDocuments(filter);
      const webhooks = await this.find(filter)
        .select("-secret")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec();
      return {
        success: true,
        data: webhooks,
        message: "successfully listed webhooks",
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
      return createErrorResponse(err, "list", logger, "webhook");
    }
  },

  async findSingle(filter = {}) {
    try {
      const webhook = await this.findOne(filter).lean().exec();
      if (!isEmpty(webhook)) {
        return createSuccessResponse("get", webhook, "webhook");
      }
      return {
        success: false,
        message: "Webhook not found",
        status: httpStatus.NOT_FOUND,
        errors: { message: "No webhook found with that ID" },
      };
    } catch (err) {
      return createErrorResponse(err, "get", logger, "webhook");
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      const MUTABLE_FIELDS = ["name", "url", "events", "active"];
      const safeUpdate = {};
      for (const key of MUTABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(update, key)) {
          safeUpdate[key] = update[key];
        }
      }
      const options = { new: true, runValidators: true, context: "query" };
      const updated = await this.findOneAndUpdate(filter, safeUpdate, options)
        .select("-secret")
        .exec();
      if (!isEmpty(updated)) {
        return createSuccessResponse("update", updated._doc, "webhook");
      }
      return createNotFoundResponse("webhook", "update");
    } catch (err) {
      return createErrorResponse(err, "update", logger, "webhook");
    }
  },

  async remove(filter = {}) {
    try {
      const result = await this.findOneAndDelete(filter).exec();
      if (!isEmpty(result)) {
        return createSuccessResponse("delete", result, "webhook");
      }
      return createNotFoundResponse("webhook", "delete");
    } catch (err) {
      return createErrorResponse(err, "delete", logger, "webhook");
    }
  },

  // Used by the dispatcher — returns webhooks WITH secret for signing.
  async findActiveForEvent(tenant, event) {
    try {
      return await this.find({ tenant, active: true, events: event }).lean().exec();
    } catch (err) {
      logger.error(`findActiveForEvent failed: ${err.message}`);
      return [];
    }
  },
};

const FeedbackWebhookModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  return getModelByTenant(dbTenant, "feedbackWebhook", FeedbackWebhookSchema);
};

module.exports = { FeedbackWebhookModel, WEBHOOK_EVENTS };
