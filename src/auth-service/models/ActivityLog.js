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
//
// NOTE: this index is only (re)declared at process startup — changing
// ACTIVITY_LOG_RETENTION_DAYS on a running deployment does not retroactively
// add/drop/update the TTL index on an already-provisioned collection, only a
// restart plus one of the calls below will. Use the existing DATABASE_ADMIN
// index-maintenance endpoints (routes/v2/admin.routes.js) rather than a
// manual DB console session — each call needs ?tenant=<tenant> and runs
// once per tenant database:
//
//   Enable/change retention:
//     POST /api/v2/admin/maintenance/db/create-index
//     { "collectionName": "activity_logs",
//       "indexSpec": { "createdAt": 1 },
//       "indexOptions": { "expireAfterSeconds": <DAYS * 86400> },
//       "secret": "<ADMIN_SETUP_SECRET>", "confirm": "CREATE_INDEX" }
//   (if a differently-valued TTL index already exists, drop it first — Mongo
//   rejects creating one with the same key but different options in place)
//
//   Disable retention / change the value:
//     POST /api/v2/admin/maintenance/db/drop-index
//     { "collectionName": "activity_logs", "indexName": "createdAt_1",
//       "secret": "<ADMIN_SETUP_SECRET>", "confirm": "DROP_INDEX" }
//
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
      // Resolve the effective limit once and reuse it everywhere below —
      // `limit`'s default only kicks in for `undefined`, so a caller passing
      // 0 (or another falsy value) would otherwise divide by zero in the
      // page/pages calculation while the query itself fell back correctly.
      const effectiveLimit = limit ? limit : parseInt(constants.DEFAULT_LIMIT);
      const effectiveSkip = skip ? skip : 0;

      const data = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(effectiveSkip)
        .limit(effectiveLimit)
        .lean();

      const totalCount = await this.countDocuments(filter);

      return {
        success: true,
        data,
        message: "successfully listed the activity logs",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip: effectiveSkip,
          limit: effectiveLimit,
          page: Math.floor(effectiveSkip / effectiveLimit) + 1,
          pages: Math.ceil(totalCount / effectiveLimit) || 1,
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
  // getModelByTenant registers the model on a per-tenant `useDb()` connection
  // and already returns the existing compiled model if one is registered
  // there — it has its own internal get-or-create check. The plain
  // `mongoose.model("activity_logs")` lookup this used to try first reads
  // from the default global connection's registry, which is a different
  // registry than the tenant-scoped one `getModelByTenant` uses, so that
  // lookup would never actually hit in this multi-tenant setup.
  return getModelByTenant(dbTenant, "activity_log", ActivityLogSchema);
};

module.exports = ActivityLogModel;
