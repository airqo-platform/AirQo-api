const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logObject, HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-status-alert-model`
);

const networkStatusAlertSchema = new Schema(
  {
    checked_at: {
      type: Date,
      required: true,
    },
    total_deployed_devices: {
      type: Number,
      required: true,
      min: 0,
    },
    not_transmitting_devices_count: {
      type: Number,
      required: true,
      min: 0,
    },
    not_transmitting_percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    status: {
      type: String,
      required: true,
      enum: ["OK", "WARNING", "CRITICAL"],
      default: "OK",
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "LOW",
    },
    message: {
      type: String,
      required: true,
    },
    threshold_exceeded: {
      type: Boolean,
      required: true,
      default: false,
    },
    threshold_value: {
      type: Number,
      required: true,
    },
    alert_type: {
      type: String,
      required: true,
      default: "NETWORK_STATUS",
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
    // Additional metadata for future analysis
    day_of_week: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
    },
    hour_of_day: {
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

// Add indexes for efficient querying
networkStatusAlertSchema.index({ checked_at: -1 });
networkStatusAlertSchema.index({ status: 1 });
networkStatusAlertSchema.index({ tenant: 1, checked_at: -1 }); // Compound index for tenant-specific queries
networkStatusAlertSchema.index({ not_transmitting_percentage: 1 });
networkStatusAlertSchema.index({ threshold_exceeded: 1 });
networkStatusAlertSchema.index({ day_of_week: 1, hour_of_day: 1 });

networkStatusAlertSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

networkStatusAlertSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      checked_at: this.checked_at,
      total_deployed_devices: this.total_deployed_devices,
      not_transmitting_devices_count: this.not_transmitting_devices_count,
      not_transmitting_percentage: this.not_transmitting_percentage,
      status: this.status,
      severity: this.severity,
      message: this.message,
      threshold_exceeded: this.threshold_exceeded,
      threshold_value: this.threshold_value,
      alert_type: this.alert_type,
      tenant: this.tenant,
      environment: this.environment,
      day_of_week: this.day_of_week,
      hour_of_day: this.hour_of_day,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

networkStatusAlertSchema.statics = {
  async register(args, next) {
    try {
      let createdAlert = await this.create(args);

      if (!isEmpty(createdAlert)) {
        let data = createdAlert._doc;
        data.__v = undefined;
        data.updatedAt = undefined;
        return {
          success: true,
          data,
          message: "Network status alert created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdAlert)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message:
                "Network status alert not created despite successful operation",
            }
          )
        );
      }
    } catch (error) {
      logObject("the error", error);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      Object.entries(error.errors || {}).forEach(([key, value]) => {
        response.message = value.message;
        response[key] = value.message;
        return response;
      });

      next(new HttpError(message, status, response));
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const response = await this.find(filter)
        .sort({ checked_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the network status alerts",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no network status alerts exist",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logObject("the error", error);
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(`🐛🐛 Internal Server Error -- ${stringifiedMessage}`);

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  async executeAggregation({ pipeline = [] } = {}, next) {
    try {
      // In a static method, 'this' refers to the model itself
      // We can call the native aggregate method directly since we renamed our method
      const response = await this.aggregate(pipeline);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully performed aggregation",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no aggregation results",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logObject("the error", error);
      const stringifiedMessage = JSON.stringify(error || "");
      logger.error(`🐛🐛 Internal Server Error -- ${stringifiedMessage}`);

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  async getStatistics({ filter = {} } = {}, next) {
    try {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAlerts: { $sum: 1 },
            avg_not_transmitting_percentage: {
              $avg: "$not_transmitting_percentage",
            },
            max_not_transmitting_percentage: {
              $max: "$not_transmitting_percentage",
            },
            min_not_transmitting_percentage: {
              $min: "$not_transmitting_percentage",
            },
            warningCount: {
              $sum: { $cond: [{ $eq: ["$status", "WARNING"] }, 1, 0] },
            },
            criticalCount: {
              $sum: { $cond: [{ $eq: ["$status", "CRITICAL"] }, 1, 0] },
            },
          },
        },
      ];

      return this.executeAggregation({ pipeline }, next);
    } catch (error) {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  async getHourlyTrends({ filter = {} } = {}, next) {
    try {
      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: {
              hour: "$hour_of_day",
              dayOfWeek: "$day_of_week",
            },
            avg_not_transmitting_percentage: {
              $avg: "$not_transmitting_percentage",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.dayOfWeek": 1, "_id.hour": 1 } },
      ];

      return this.executeAggregation({ pipeline }, next);
    } catch (error) {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

const NetworkStatusAlertModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const networkStatusAlerts = mongoose.model("networkStatusAlerts");
    return networkStatusAlerts;
  } catch (errors) {
    return getModelByTenant(
      dbTenant.toLowerCase(),
      "networkStatusAlert",
      networkStatusAlertSchema
    );
  }
};

module.exports = NetworkStatusAlertModel;
