const mongoose = require("mongoose");
const { Schema } = mongoose;
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device_uptime model`
);
const moment = require("moment-timezone");

const deviceUptimeSchema = new Schema(
  {
    created_at: {
      type: Date,
      required: true,
      index: true,
    },
    device_name: {
      type: String,
      required: true,
      index: true,
    },
    downtime: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    uptime: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    battery_voltage: {
      type: Number,
      min: 0,
    },
    channel_id: {
      type: String,
      index: true,
    },
    sensor_one_pm2_5: {
      type: Number,
      min: 0,
    },
    sensor_two_pm2_5: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ["online", "offline", "maintenance"],
      default: "offline",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add compound indexes for common queries
deviceUptimeSchema.index({ device_name: 1, created_at: -1 });
deviceUptimeSchema.index({ channel_id: 1, created_at: -1 });

// Add virtuals
deviceUptimeSchema.virtual("uptimePercentage").get(function() {
  return (this.uptime / (this.uptime + this.downtime)) * 100 || 0;
});

deviceUptimeSchema.virtual("averagePM25").get(function() {
  const validReadings = [this.sensor_one_pm2_5, this.sensor_two_pm2_5].filter(
    (reading) => reading != null
  );
  return validReadings.length
    ? validReadings.reduce((a, b) => a + b) / validReadings.length
    : null;
});

deviceUptimeSchema.statics = {
  async getUptimeLeaderboard(tenant, { startDate, endDate, limit = null }) {
    try {
      const pipeline = [
        {
          $match: {
            created_at: {
              $gte: startDate,
              $lt: endDate,
            },
          },
        },
        {
          $group: {
            _id: "$device_name",
            device_name: { $first: "$device_name" },
            downtime: { $avg: "$downtime" },
            uptime: { $avg: "$uptime" },
            total_records: { $sum: 1 },
            average_battery: { $avg: "$battery_voltage" },
            last_seen: { $max: "$created_at" },
            average_pm25: {
              $avg: {
                $divide: [
                  { $add: ["$sensor_one_pm2_5", "$sensor_two_pm2_5"] },
                  2,
                ],
              },
            },
          },
        },
        {
          $addFields: {
            uptime_percentage: {
              $multiply: [
                { $divide: ["$uptime", { $add: ["$uptime", "$downtime"] }] },
                100,
              ],
            },
            status: {
              $cond: {
                if: { $gt: ["$uptime", "$downtime"] },
                then: "online",
                else: "offline",
              },
            },
          },
        },
        { $sort: { uptime_percentage: -1 } },
      ];

      if (limit) {
        pipeline.push({ $limit: parseInt(limit) });
      }

      const results = await this.aggregate(pipeline);

      return {
        success: true,
        message: "Successfully retrieved device uptime leaderboard",
        data: results,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving device uptime leaderboard:", error);
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

  async getDeviceUptime(
    tenant,
    { startDate, endDate, devices, deviceName, interval }
  ) {
    try {
      const filter = {
        created_at: {
          $gte: startDate,
          $lt: endDate,
        },
      };

      if (devices) {
        filter.device_name = { $in: devices.split(",").map((d) => d.trim()) };
      } else if (deviceName) {
        filter.device_name = deviceName;
      }

      const basePipeline = [
        { $match: filter },
        {
          $group: {
            _id: {
              device_name: "$device_name",
              ...(interval && {
                interval: this._getIntervalGrouping("$created_at", interval),
              }),
            },
            values: {
              $push: {
                _id: { $toString: "$_id" },
                battery_voltage: "$battery_voltage",
                channel_id: "$channel_id",
                created_at: {
                  $dateToString: {
                    date: "$created_at",
                    format: "%Y-%m-%dT%H:%M:%S%z",
                    timezone: "Africa/Kampala",
                  },
                },
                device_name: "$device_name",
                downtime: "$downtime",
                sensor_one_pm2_5: "$sensor_one_pm2_5",
                sensor_two_pm2_5: "$sensor_two_pm2_5",
                uptime: "$uptime",
                average_pm25: {
                  $avg: {
                    $divide: [
                      { $add: ["$sensor_one_pm2_5", "$sensor_two_pm2_5"] },
                      2,
                    ],
                  },
                },
              },
            },
            uptime_avg: { $avg: "$uptime" },
            downtime_avg: { $avg: "$downtime" },
            battery_avg: { $avg: "$battery_voltage" },
            total_records: { $sum: 1 },
          },
        },
        {
          $addFields: {
            uptime_percentage: {
              $multiply: [
                {
                  $divide: [
                    "$uptime_avg",
                    { $add: ["$uptime_avg", "$downtime_avg"] },
                  ],
                },
                100,
              ],
            },
          },
        },
        { $sort: { "_id.device_name": 1, "_id.interval": 1 } },
      ];

      const results = await this.aggregate(basePipeline);

      return {
        success: true,
        message: "Successfully retrieved device uptime",
        data: results,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving device uptime:", error);
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

  async getUptimeStats(tenant, { deviceName, startDate, endDate }) {
    try {
      const pipeline = [
        {
          $match: {
            device_name: deviceName,
            created_at: {
              $gte: startDate,
              $lt: endDate,
            },
          },
        },
        {
          $group: {
            _id: null,
            total_uptime: { $sum: "$uptime" },
            total_downtime: { $sum: "$downtime" },
            average_uptime: { $avg: "$uptime" },
            average_downtime: { $avg: "$downtime" },
            max_uptime: { $max: "$uptime" },
            min_uptime: { $min: "$uptime" },
            total_records: { $sum: 1 },
            average_battery: { $avg: "$battery_voltage" },
            last_seen: { $max: "$created_at" },
          },
        },
        {
          $addFields: {
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
          },
        },
      ];

      const results = await this.aggregate(pipeline);

      return {
        success: true,
        message: "Successfully retrieved uptime statistics",
        data: results[0] || null,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving uptime statistics:", error);
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
};

const DeviceUptimeModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  try {
    return mongoose.model("device_uptime");
  } catch (error) {
    return getModelByTenant(
      dbTenant.toLowerCase(),
      "device_uptime",
      deviceUptimeSchema
    );
  }
};

module.exports = DeviceUptimeModel;
