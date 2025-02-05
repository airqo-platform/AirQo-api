const mongoose = require("mongoose");
const { Schema } = mongoose;
const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device_status model`
);
const moment = require("moment-timezone");

// Define device sub-schema for reusability
const deviceDetailsSchema = new Schema(
  {
    device_id: {
      type: Schema.Types.ObjectId,
      ref: "device",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    serial_number: String,
    elapsed_time: {
      type: Number,
      min: 0,
    },
    elapsed_time_readable: String,
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    last_reading: Date,
    battery_voltage: Number,
    signal_strength: Number,
    firmware_version: String,
  },
  { _id: false }
);

const deviceStatusSchema = new Schema(
  {
    created_at: {
      type: Date,
      required: true,
      index: true,
    },
    total_active_device_count: {
      type: Number,
      required: true,
      min: 0,
    },
    metrics: {
      online: {
        count: { type: Number, default: 0, min: 0 },
        percentage: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },
        devices: [deviceDetailsSchema],
      },
      offline: {
        count: { type: Number, default: 0, min: 0 },
        percentage: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },
        devices: [deviceDetailsSchema],
      },
      maintenance: {
        count: { type: Number, default: 0, min: 0 },
        percentage: {
          type: Number,
          default: 0,
          min: 0,
          max: 100,
        },
        devices: [deviceDetailsSchema],
      },
    },
    check_type: {
      type: String,
      enum: ["hourly", "daily", "weekly", "monthly"],
      required: true,
      index: true,
    },
    power_metrics: {
      solar: {
        count: { type: Number, default: 0, min: 0 },
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        devices: [deviceDetailsSchema],
      },
      mains: {
        count: { type: Number, default: 0, min: 0 },
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        devices: [deviceDetailsSchema],
      },
      alternator: {
        count: { type: Number, default: 0, min: 0 },
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        devices: [deviceDetailsSchema],
      },
    },
    maintenance_metrics: {
      due: {
        count: { type: Number, default: 0, min: 0 },
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        devices: [deviceDetailsSchema],
      },
      overdue: {
        count: { type: Number, default: 0, min: 0 },
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        devices: [deviceDetailsSchema],
      },
      unspecified: {
        count: { type: Number, default: 0, min: 0 },
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        devices: [deviceDetailsSchema],
      },
    },
    health_metrics: {
      battery_health: {
        good: { type: Number, default: 0 },
        warning: { type: Number, default: 0 },
        critical: { type: Number, default: 0 },
      },
      connectivity_health: {
        good: { type: Number, default: 0 },
        warning: { type: Number, default: 0 },
        critical: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Optimize indexes
deviceStatusSchema.index({ created_at: -1, check_type: 1 });
deviceStatusSchema.index({ "metrics.online.count": 1, created_at: -1 });
deviceStatusSchema.index({ "metrics.offline.count": 1, created_at: -1 });
deviceStatusSchema.index({ check_type: 1, created_at: -1 });

// Add virtuals
deviceStatusSchema.virtual("total_devices").get(function() {
  return (
    this.metrics.online.count +
    this.metrics.offline.count +
    this.metrics.maintenance.count
  );
});

deviceStatusSchema.virtual("health_score").get(function() {
  const onlinePercentage = this.metrics.online.percentage;
  const batteryHealth =
    (this.health_metrics.battery_health.good / this.total_active_device_count) *
    100;
  const connectivityHealth =
    (this.health_metrics.connectivity_health.good /
      this.total_active_device_count) *
    100;

  return (
    onlinePercentage * 0.4 + batteryHealth * 0.3 + connectivityHealth * 0.3
  );
});

deviceStatusSchema.statics = {
  async getDeviceStatus(
    tenant,
    { startDate, endDate, limit = null, checkType = null, aggregateBy = null }
  ) {
    try {
      const filter = {
        created_at: {
          $gte: startDate,
          $lt: endDate,
        },
      };

      if (checkType) {
        filter.check_type = checkType;
      }

      if (aggregateBy) {
        return await this._getAggregatedStatus(filter, aggregateBy);
      }

      const query = this.find(filter)
        .sort({ created_at: -1 })
        .populate({
          path:
            "metrics.online.devices.device_id metrics.offline.devices.device_id",
          select: "name serial_number location",
        });

      if (limit) {
        query.limit(parseInt(limit));
      }

      const results = await query.exec();

      return {
        success: true,
        message: "Successfully retrieved device status",
        data: results,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving device status:", error);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
          details: error.stack,
        }
      );
    }
  },

  async _getAggregatedStatus(filter, aggregateBy) {
    const grouping = this._getTimeGrouping("$created_at", aggregateBy);

    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: grouping,
          total_active_devices: { $avg: "$total_active_device_count" },
          online_count: { $avg: "$metrics.online.count" },
          offline_count: { $avg: "$metrics.offline.count" },
          maintenance_count: { $avg: "$metrics.maintenance.count" },
          solar_powered: { $avg: "$power_metrics.solar.count" },
          mains_powered: { $avg: "$power_metrics.mains.count" },
          maintenance_due: { $avg: "$maintenance_metrics.due.count" },
          maintenance_overdue: { $avg: "$maintenance_metrics.overdue.count" },
          battery_health_critical: {
            $avg: "$health_metrics.battery_health.critical",
          },
        },
      },
      {
        $addFields: {
          time_period: "$_id",
          online_percentage: {
            $multiply: [
              { $divide: ["$online_count", "$total_active_devices"] },
              100,
            ],
          },
          health_score: {
            $multiply: [
              {
                $add: [
                  {
                    $multiply: [
                      { $divide: ["$online_count", "$total_active_devices"] },
                      0.4,
                    ],
                  },
                  {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $subtract: [
                              "$total_active_devices",
                              "$battery_health_critical",
                            ],
                          },
                          "$total_active_devices",
                        ],
                      },
                      0.3,
                    ],
                  },
                  {
                    $multiply: [
                      { $divide: ["$online_count", "$total_active_devices"] },
                      0.3,
                    ],
                  },
                ],
              },
              100,
            ],
          },
        },
      },
      { $sort: { time_period: 1 } },
    ];

    const results = await this.aggregate(pipeline);

    return {
      success: true,
      message: "Successfully retrieved aggregated device status",
      data: results,
      status: httpStatus.OK,
    };
  },

  _getTimeGrouping(dateField, interval) {
    switch (interval) {
      case "hour":
        return {
          year: { $year: dateField },
          month: { $month: dateField },
          day: { $dayOfMonth: dateField },
          hour: { $hour: dateField },
        };
      case "day":
        return {
          year: { $year: dateField },
          month: { $month: dateField },
          day: { $dayOfMonth: dateField },
        };
      case "week":
        return {
          year: { $year: dateField },
          week: { $week: dateField },
        };
      case "month":
        return {
          year: { $year: dateField },
          month: { $month: dateField },
        };
      default:
        return null;
    }
  },

  async getStatusSummary(tenant, { checkType = "hourly" }) {
    try {
      const latestStatus = await this.findOne({ check_type: checkType })
        .sort({ created_at: -1 })
        .exec();

      if (!latestStatus) {
        throw new HttpError("No status data found", httpStatus.NOT_FOUND);
      }

      const healthScore = latestStatus.health_score;
      const healthStatus = this._determineHealthStatus(healthScore);

      return {
        success: true,
        message: "Successfully retrieved status summary",
        data: {
          timestamp: latestStatus.created_at,
          total_devices: latestStatus.total_active_device_count,
          online_devices: latestStatus.metrics.online.count,
          offline_devices: latestStatus.metrics.offline.count,
          maintenance_devices: latestStatus.metrics.maintenance.count,
          health_score: healthScore,
          health_status: healthStatus,
          power_distribution: latestStatus.power_metrics,
          maintenance_status: latestStatus.maintenance_metrics,
          health_metrics: latestStatus.health_metrics,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving status summary:", error);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
          details: error.stack,
        }
      );
    }
  },

  _determineHealthStatus(healthScore) {
    if (healthScore >= 90) return "excellent";
    if (healthScore >= 75) return "good";
    if (healthScore >= 60) return "fair";
    return "poor";
  },
};

const DeviceStatusModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  try {
    return mongoose.model("device_status");
  } catch (error) {
    return getModelByTenant(
      dbTenant.toLowerCase(),
      "device_status",
      deviceStatusSchema
    );
  }
};

module.exports = DeviceStatusModel;
