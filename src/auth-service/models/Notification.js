const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const {
  createErrorResponse,
  createNotFoundResponse,
} = require("@utils/shared");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- notification-model`,
);

const NOTIFICATION_CATEGORIES = [
  "access_request",
  "announcement",
  "data",
  "activity",
  "system",
];

const NOTIFICATION_PRIORITIES = ["low", "normal", "high"];

// In-app notifications expire automatically; read or unread, nothing is
// kept beyond this window unless the sender sets an explicit expiry.
const DEFAULT_RETENTION_DAYS = 90;

// The shared helper reports "not found" as 400; inbox clients need a real 404.
const notFound = (operation) => ({
  ...createNotFoundResponse("notification", operation, "notification not found"),
  status: httpStatus.NOT_FOUND,
});

const defaultExpiry = () =>
  new Date(Date.now() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000);

const NotificationSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: [true, "user_id is required"],
    },
    category: {
      type: String,
      enum: NOTIFICATION_CATEGORIES,
      default: "system",
    },
    // Machine-readable event name (e.g. "access_request.approved") so the
    // frontend can pick an icon or behaviour without parsing the title.
    event: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: [true, "message is required"],
      trim: true,
      maxlength: 2000,
    },
    link: {
      type: String,
      trim: true,
      maxlength: 2048,
    },
    priority: {
      type: String,
      enum: NOTIFICATION_PRIORITIES,
      default: "normal",
    },
    group_id: {
      type: Schema.Types.ObjectId,
      ref: "group",
    },
    sender_id: {
      type: Schema.Types.ObjectId,
      ref: "user",
    },
    // Shared by every copy of one admin broadcast, for auditing and recall.
    broadcast_id: {
      type: String,
      trim: true,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
    },
    read_at: {
      type: Date,
    },
    expires_at: {
      type: Date,
      default: defaultExpiry,
      // expireAfterSeconds: 0 means "delete at the moment stored in this field"
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: true },
);

NotificationSchema.index({ user_id: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ user_id: 1, category: 1, createdAt: -1 });

NotificationSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      user_id: this.user_id,
      category: this.category,
      event: this.event,
      title: this.title,
      message: this.message,
      link: this.link,
      priority: this.priority,
      group_id: this.group_id,
      sender_id: this.sender_id,
      broadcast_id: this.broadcast_id,
      metadata: this.metadata,
      read: this.read,
      read_at: this.read_at,
      expires_at: this.expires_at,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

NotificationSchema.statics = {
  async createMany(docs = []) {
    try {
      if (isEmpty(docs)) {
        return {
          success: true,
          message: "no notifications to create",
          data: { insertedCount: 0 },
          status: httpStatus.OK,
        };
      }
      // ordered:false keeps going past a bad document instead of aborting
      // the rest of the batch.
      const inserted = await this.insertMany(docs, { ordered: false });
      return {
        success: true,
        message: "successfully created the notifications",
        data: { insertedCount: inserted.length },
        status: httpStatus.CREATED,
      };
    } catch (err) {
      return createErrorResponse(err, "create", logger, "notification");
    }
  },

  async list({ filter = {}, limit = 20, skip = 0 } = {}) {
    try {
      const [notifications, total, unread] = await Promise.all([
        this.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.countDocuments(filter),
        this.countDocuments({ user_id: filter.user_id, read: false }),
      ]);

      return {
        success: true,
        data: notifications,
        message: "successfully listed the notifications",
        status: httpStatus.OK,
        meta: {
          total,
          unread,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (err) {
      return createErrorResponse(err, "list", logger, "notification");
    }
  },

  async countUnread({ user_id } = {}) {
    try {
      const unread = await this.countDocuments({ user_id, read: false });
      return {
        success: true,
        data: { unread },
        message: "successfully counted unread notifications",
        status: httpStatus.OK,
      };
    } catch (err) {
      return createErrorResponse(err, "count", logger, "notification");
    }
  },

  async markRead({ filter = {} } = {}) {
    try {
      const notification = await this.findOneAndUpdate(
        filter,
        { $set: { read: true, read_at: new Date() } },
        { new: true },
      ).exec();

      if (!isEmpty(notification)) {
        return {
          success: true,
          data: notification,
          message: "notification marked as read",
          status: httpStatus.OK,
        };
      }
      return notFound("update");
    } catch (err) {
      return createErrorResponse(err, "update", logger, "notification");
    }
  },

  async markAllRead({ user_id } = {}) {
    try {
      const result = await this.updateMany(
        { user_id, read: false },
        { $set: { read: true, read_at: new Date() } },
      ).exec();

      return {
        success: true,
        data: { modifiedCount: result.modifiedCount ?? result.nModified ?? 0 },
        message: "all notifications marked as read",
        status: httpStatus.OK,
      };
    } catch (err) {
      return createErrorResponse(err, "update", logger, "notification");
    }
  },

  async remove({ filter = {} } = {}) {
    try {
      const removed = await this.findOneAndDelete(filter).exec();

      if (!isEmpty(removed)) {
        return {
          success: true,
          data: removed,
          message: "successfully deleted the notification",
          status: httpStatus.OK,
        };
      }
      return notFound("delete");
    } catch (err) {
      return createErrorResponse(err, "delete", logger, "notification");
    }
  },
};

const NotificationModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  return getModelByTenant(dbTenant, "notification", NotificationSchema);
};

NotificationModel.NOTIFICATION_CATEGORIES = NOTIFICATION_CATEGORIES;
NotificationModel.NOTIFICATION_PRIORITIES = NOTIFICATION_PRIORITIES;

module.exports = NotificationModel;
