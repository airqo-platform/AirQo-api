const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = mongoose.Schema.Types.ObjectId;
const httpStatus = require("http-status");
const {
  createSuccessResponse,
  createErrorResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- activity-log-model`,
);

const ActorSchema = new Schema(
  {
    user_id: { type: ObjectId, ref: "user" },
    name: { type: String, trim: true },
    email: { type: String, trim: true },
  },
  { _id: false },
);

const ActivityLogSchema = new Schema(
  {
    group_id: {
      type: ObjectId,
      ref: "group",
      required: [true, "group_id is required"],
    },
    // Not a hard enum: new event types can be added without a schema migration.
    activity_type: {
      type: String,
      trim: true,
      required: [true, "activity_type is required"],
    },
    actor: {
      type: ActorSchema,
      required: [true, "actor is required"],
    },
    // Optional: not every activity has a single target user (e.g. group updates).
    target_user: {
      type: ActorSchema,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    tenant: {
      type: String,
      trim: true,
      lowercase: true,
      default: "airqo",
    },
  },
  {
    timestamps: true,
  },
);

ActivityLogSchema.index({ group_id: 1, createdAt: -1 });
ActivityLogSchema.index({ tenant: 1, createdAt: -1 });
ActivityLogSchema.index({ activity_type: 1 });

// This is a compliance-relevant audit trail (who removed/promoted whom), so it
// does not auto-expire unless ACTIVITY_LOG_RETENTION_DAYS is explicitly set.
if (constants.ACTIVITY_LOG_RETENTION_DAYS > 0) {
  ActivityLogSchema.index(
    { createdAt: 1 },
    { expireAfterSeconds: constants.ACTIVITY_LOG_RETENTION_DAYS * 24 * 60 * 60 },
  );
}

ActivityLogSchema.statics = {
  async logActivity(activityData, next) {
    try {
      const enrichedData = {
        ...activityData,
        tenant: activityData.tenant || "airqo",
      };
      const data = await this.create(enrichedData);

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "activity log", {
          message: "activity logged successfully",
        });
      } else {
        return createEmptySuccessResponse(
          "activity log",
          "operation successful but activity NOT logged",
        );
      }
    } catch (error) {
      // Logging failures must never break the caller's main operation.
      logger.warn(`Activity logging failed: ${error.message}`);
      return createErrorResponse(error, "create", logger, "activity log");
    }
  },

  async list({ filter = {}, limit = 100, skip = 0 } = {}, next) {
    try {
      const data = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : parseInt(constants.DEFAULT_LIMIT))
        .lean();

      const totalCount = await this.countDocuments(filter);

      return {
        success: true,
        data,
        message: "successfully listed the activity logs",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "activity log");
    }
  },
};

const ActivityLogModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const activity_logs = mongoose.model("activity_logs");
    return activity_logs;
  } catch (error) {
    const activity_logs = getModelByTenant(
      dbTenant,
      "activity_log",
      ActivityLogSchema,
    );
    return activity_logs;
  }
};

module.exports = ActivityLogModel;
