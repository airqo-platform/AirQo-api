const mongoose = require("mongoose");
const { Schema } = mongoose;
const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network_uptime model`
);
const moment = require("moment-timezone");

const networkUptimeSchema = new Schema(
  {
    created_at: {
      type: Date,
      required: true,
      index: true,
    },
    network_name: {
      type: String,
      required: true,
      index: true,
    },
    uptime: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    downtime: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    total_devices: {
      type: Number,
      min: 0,
      default: 0,
    },
    active_devices: {
      type: Number,
      min: 0,
      default: 0,
    },
    network_status: {
      type: String,
      enum: ["operational", "degraded", "down"],
      default: "operational",
    },
    maintenance_mode: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add compound indexes for common queries
networkUptimeSchema.index({ network_name: 1, created_at: -1 });
networkUptimeSchema.index({ network_status: 1, created_at: -1 });

// Add virtuals
networkUptimeSchema.virtual("uptimePercentage").get(function() {
  return (this.uptime / (this.uptime + this.downtime)) * 100 || 0;
});

networkUptimeSchema.virtual("deviceUtilization").get(function() {
  return this.total_devices > 0
    ? (this.active_devices / this.total_devices) * 100
    : 0;
});

networkUptimeSchema.statics = {
  async getNetworkUptime(
    tenant,
    { startDate, endDate, networkName, interval }
  ) {
    try {
      const matchStage = {
        created_at: {
          $gte: startDate,
          $lt: endDate,
        },
      };

      if (networkName) {
        matchStage.network_name = networkName;
      }

      const basePipeline = [
        { $match: matchStage },
        {
          $group: {
            _id: {
              network_name: "$network_name",
              ...(interval && {
                interval: this._getIntervalGrouping("$created_at", interval),
              }),
            },
            values: {
              $push: {
                _id: { $toString: "$_id" },
                created_at: {
                  $dateToString: {
                    date: "$created_at",
                    format: "%Y-%m-%dT%H:%M:%S%z",
                    timezone: "Africa/Kampala",
                  },
                },
                network_name: "$network_name",
                uptime: "$uptime",
                downtime: "$downtime",
                total_devices: "$total_devices",
                active_devices: "$active_devices",
                network_status: "$network_status",
              },
            },
            average_uptime: { $avg: "$uptime" },
            average_downtime: { $avg: "$downtime" },
            total_records: { $sum: 1 },
            avg_total_devices: { $avg: "$total_devices" },
            avg_active_devices: { $avg: "$active_devices" },
          },
        },
        {
          $addFields: {
            uptime_percentage: {
              $multiply: [
                {
                  $divide: [
                    "$average_uptime",
                    { $add: ["$average_uptime", "$average_downtime"] },
                  ],
                },
                100,
              ],
            },
            device_utilization: {
              $multiply: [
                { $divide: ["$avg_active_devices", "$avg_total_devices"] },
                100,
              ],
            },
          },
        },
        { $sort: { "_id.network_name": 1, "_id.interval": 1 } },
      ];

      const results = await this.aggregate(basePipeline);

      return {
        success: true,
        message: "Successfully retrieved network uptime",
        data: results,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving network uptime:", error);
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

  _getIntervalGrouping(dateField, interval) {
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

  async getNetworkStats(tenant, { networkName, startDate, endDate }) {
    try {
      const pipeline = [
        {
          $match: {
            ...(networkName && { network_name: networkName }),
            created_at: {
              $gte: startDate,
              $lt: endDate,
            },
          },
        },
        {
          $group: {
            _id: "$network_name",
            total_uptime: { $sum: "$uptime" },
            total_downtime: { $sum: "$downtime" },
            average_uptime: { $avg: "$uptime" },
            average_downtime: { $avg: "$downtime" },
            max_uptime: { $max: "$uptime" },
            min_uptime: { $min: "$uptime" },
            total_records: { $sum: 1 },
            avg_total_devices: { $avg: "$total_devices" },
            avg_active_devices: { $avg: "$active_devices" },
            status_counts: {
              $addToSet: {
                status: "$network_status",
                count: { $sum: 1 },
              },
            },
            last_seen: { $max: "$created_at" },
          },
        },
        {
          $project: {
            _id: 1,
            network_name: "$_id",
            total_uptime: 1,
            total_downtime: 1,
            average_uptime: 1,
            average_downtime: 1,
            max_uptime: 1,
            min_uptime: 1,
            total_records: 1,
            avg_total_devices: 1,
            avg_active_devices: 1,
            status_counts: 1,
            last_seen: 1,
            uptime_percentage: {
              $multiply: [
                {
                  $divide: [
                    "$total_uptime",
                    { $add: ["$total_uptime", "$total_downtime"] },
                  ],
                },
                100,
              ],
            },
            device_utilization: {
              $multiply: [
                { $divide: ["$avg_active_devices", "$avg_total_devices"] },
                100,
              ],
            },
          },
        },
        { $sort: { uptime_percentage: -1 } },
      ];

      const results = await this.aggregate(pipeline);

      return {
        success: true,
        message: "Successfully retrieved network statistics",
        data: networkName ? results[0] : results,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving network statistics:", error);
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

  async getNetworkHealth(tenant, { networkName }) {
    try {
      const endDate = new Date();
      const startDate = moment(endDate)
        .subtract(24, "hours")
        .toDate();

      const healthStats = await this.getNetworkStats(tenant, {
        networkName,
        startDate,
        endDate,
      });

      const healthData = healthStats.data;
      const healthScore = this._calculateHealthScore(healthData);

      return {
        success: true,
        message: "Successfully retrieved network health",
        data: {
          network_name: networkName,
          health_score: healthScore,
          status: this._determineHealthStatus(healthScore),
          last_24h_stats: healthData,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving network health:", error);
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

  _calculateHealthScore(healthData) {
    if (!healthData) return 0;

    const weights = {
      uptime: 0.4,
      deviceUtilization: 0.3,
      reliability: 0.3,
    };

    const uptimeScore = healthData.uptime_percentage || 0;
    const deviceScore = healthData.device_utilization || 0;
    const reliabilityScore = (healthData.total_records / 288) * 100; // 288 is expected records for 5-minute intervals in 24h

    return (
      uptimeScore * weights.uptime +
      deviceScore * weights.deviceUtilization +
      reliabilityScore * weights.reliability
    );
  },

  _determineHealthStatus(healthScore) {
    if (healthScore >= 90) return "excellent";
    if (healthScore >= 75) return "good";
    if (healthScore >= 60) return "fair";
    return "poor";
  },
};

const NetworkUptimeModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  try {
    return mongoose.model("network_uptime");
  } catch (error) {
    return getModelByTenant(
      dbTenant.toLowerCase(),
      "network_uptime",
      networkUptimeSchema
    );
  }
};

module.exports = NetworkUptimeModel;
