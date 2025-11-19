const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logObject, HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- activity-log-model`
);
const moment = require("moment-timezone");

const activityLogSchema = new Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    operation_type: {
      type: String,
      required: true,
      enum: [
        "INSERT",
        "UPDATE",
        "DELETE",
        "BULK_INSERT",
        "BULK_UPDATE",
        "UPSERT",
      ],
    },
    entity_type: {
      type: String,
      required: true,
      enum: [
        "EVENT",
        "READING",
        "DEVICE",
        "SITE",
        "GRID",
        "USER",
        "ALERT",
        "OTHER",
      ],
    },
    entity_id: {
      type: String,
    },
    status: {
      type: String,
      required: true,
      enum: ["SUCCESS", "FAILURE", "PARTIAL_SUCCESS"],
    },
    records_attempted: {
      type: Number,
      default: 1,
      min: 0,
    },
    records_successful: {
      type: Number,
      default: 0,
      min: 0,
    },
    records_failed: {
      type: Number,
      default: 0,
      min: 0,
    },
    error_details: {
      type: String,
      maxlength: 1000, // Limit error message length
    },
    error_code: {
      type: String,
    },
    tenant: {
      type: String,
      required: true,
      lowercase: true,
    },
    environment: {
      type: String,
      required: true,
    },
    source_function: {
      type: String,
      maxlength: 100,
    },
    execution_time_ms: {
      type: Number,
      min: 0,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    day: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    hour: {
      type: Number,
      required: true,
      min: 0,
      max: 23,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ tenant: 1, day: -1 });
activityLogSchema.index({ operation_type: 1, entity_type: 1, status: 1 });
activityLogSchema.index({ status: 1, day: -1 });
activityLogSchema.index({ entity_type: 1, day: -1 });

// TTL - expire after 30 days to keep storage lean
activityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

activityLogSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      timestamp: this.timestamp,
      operation_type: this.operation_type,
      entity_type: this.entity_type,
      entity_id: this.entity_id,
      status: this.status,
      records_attempted: this.records_attempted,
      records_successful: this.records_successful,
      records_failed: this.records_failed,
      error_details: this.error_details,
      error_code: this.error_code,
      tenant: this.tenant,
      environment: this.environment,
      source_function: this.source_function,
      execution_time_ms: this.execution_time_ms,
      day: this.day,
      hour: this.hour,
      createdAt: this.createdAt,
    };
  },
};

activityLogSchema.statics = {
  async logActivity(activityData, next) {
    try {
      // Enrich activity data with computed fields
      const timestamp = new Date(activityData.timestamp || Date.now());
      const enrichedData = {
        ...activityData,
        timestamp,
        day: moment(timestamp).format("YYYY-MM-DD"),
        hour: moment(timestamp).hour(),
        environment: constants.ENVIRONMENT,
        tenant: activityData.tenant || "airqo",
      };

      const createdActivity = await this.create(enrichedData);

      if (!isEmpty(createdActivity)) {
        return {
          success: true,
          data: createdActivity._doc,
          message: "Activity logged successfully",
          status: httpStatus.CREATED,
        };
      } else {
        const err = new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Activity not logged despite successful operation" }
        );
        if (typeof next === "function") {
          return next(err);
        }
        return {
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: err.message,
          errors: {
            message: "Activity not logged despite successful operation",
          },
        };
      }
    } catch (error) {
      // Don't let logging errors break the main operation
      logger.warn(`Activity logging failed: ${error.message}`);
      return {
        success: false,
        message: "Activity logging failed",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  async list({ filter = {}, limit = 100, skip = 0 } = {}, next) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        const total = await this.countDocuments(filter);
        const totalPages = Math.ceil(total / limit);
        const currentPage = Math.ceil(skip / limit) + 1;

        return {
          success: true,
          data: response,
          message: "Successfully retrieved the logs",
          status: httpStatus.OK,
          meta: {
            total,
            limit,
            skip,
            page: currentPage,
            pages: totalPages,
          },
        };
      } else {
        return {
          success: true,
          message: "There are no logs for this search",
          data: [],
          status: httpStatus.OK,
          meta: {
            total: 0,
            limit,
            skip,
            page: 1,
            pages: 0,
          },
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async getDailyStats({ filter = {} } = {}, next) {
    try {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: {
              day: "$day",
              entity_type: "$entity_type",
              operation_type: "$operation_type",
              status: "$status",
            },
            total_operations: { $sum: 1 },
            total_records_attempted: { $sum: "$records_attempted" },
            total_records_successful: { $sum: "$records_successful" },
            total_records_failed: { $sum: "$records_failed" },
            avg_execution_time: { $avg: "$execution_time_ms" },
            min_execution_time: { $min: "$execution_time_ms" },
            max_execution_time: { $max: "$execution_time_ms" },
          },
        },
        {
          $group: {
            _id: "$_id.day",
            stats: {
              $push: {
                entity_type: "$_id.entity_type",
                operation_type: "$_id.operation_type",
                status: "$_id.status",
                total_operations: "$total_operations",
                total_records_attempted: "$total_records_attempted",
                total_records_successful: "$total_records_successful",
                total_records_failed: "$total_records_failed",
                avg_execution_time: "$avg_execution_time",
                min_execution_time: "$min_execution_time",
                max_execution_time: "$max_execution_time",
              },
            },
            daily_totals: {
              $sum: "$total_operations",
            },
          },
        },
        { $sort: { _id: -1 } },
      ];

      const response = await this.aggregate(pipeline);

      return {
        success: true,
        message: "Daily statistics retrieved successfully",
        data: response,
        status: httpStatus.OK,
      };
    } catch (error) {
      const err = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
      if (typeof next === "function") {
        return next(err);
      }
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve daily statistics",
        errors: { message: error.message },
      };
    }
  },

  async getOperationSummary({ filter = {} } = {}, next) {
    try {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: {
              operation_type: "$operation_type",
              entity_type: "$entity_type",
              status: "$status",
            },
            count: { $sum: 1 },
            total_records_attempted: { $sum: "$records_attempted" },
            total_records_successful: { $sum: "$records_successful" },
            total_records_failed: { $sum: "$records_failed" },
            avg_execution_time: { $avg: "$execution_time_ms" },
          },
        },
        {
          $group: {
            _id: null,
            operations: {
              $push: {
                operation_type: "$_id.operation_type",
                entity_type: "$_id.entity_type",
                status: "$_id.status",
                count: "$count",
                total_records_attempted: "$total_records_attempted",
                total_records_successful: "$total_records_successful",
                total_records_failed: "$total_records_failed",
                avg_execution_time: "$avg_execution_time",
              },
            },
            overall_success_rate: {
              $avg: {
                $cond: [
                  { $eq: ["$_id.status", "SUCCESS"] },
                  100,
                  {
                    $cond: [{ $eq: ["$_id.status", "PARTIAL_SUCCESS"] }, 50, 0],
                  },
                ],
              },
            },
          },
        },
      ];

      const response = await this.aggregate(pipeline);

      return {
        success: true,
        message: "Operation summary retrieved successfully",
        data: response,
        status: httpStatus.OK,
      };
    } catch (error) {
      const err = new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
      if (typeof next === "function") {
        return next(err);
      }
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Failed to retrieve operation summary",
        errors: { message: error.message },
      };
    }
  },
};

const ActivityLogModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const activityLogs = mongoose.model("activity_logs");
    return activityLogs;
  } catch (errors) {
    return getModelByTenant(
      dbTenant.toLowerCase(),
      "activity_log",
      activityLogSchema
    );
  }
};

module.exports = ActivityLogModel;
