const mongoose = require("mongoose");
const { Schema } = mongoose;
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const logger = require("@utils/logger");

const deviceUptimeSchema = new Schema(
  {
    created_at: {
      type: Date,
      required: true,
      index: true,
    },
    device_name: { type: String },
    downtime: { type: Number },
    uptime: { type: Number },
    battery_voltage: { type: Number },
    channel_id: { type: String },
    sensor_one_pm2_5: { type: Number },
    sensor_two_pm2_5: { type: Number },
  },
  {
    timestamps: true,
  }
);

deviceUptimeSchema.statics = {
  async getUptimeLeaderboard(tenant, { startDate, endDate }) {
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
          },
        },
      ];

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
        { message: error.message }
      );
    }
  },

  async getDeviceUptime(tenant, { startDate, endDate, devices, deviceName }) {
    try {
      const filter = {
        created_at: {
          $gte: startDate,
          $lt: endDate,
        },
      };

      if (devices) {
        filter.device_name = { $in: devices.split(",") };
      } else if (deviceName) {
        filter.device_name = deviceName;
      }

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: "$device_name",
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
              },
            },
          },
        },
      ];

      const results = await this.aggregate(pipeline);

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
        { message: error.message }
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
