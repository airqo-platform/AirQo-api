const mongoose = require("mongoose");
const { Schema } = mongoose;
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device_status model`
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
    },
    metrics: {
      online: {
        count: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        devices: [
          {
            device_id: { type: Schema.Types.ObjectId, ref: "device" },
            name: String,
            serial_number: String,
            elapsed_time: Number,
            elapsed_time_readable: String,
            latitude: Number,
            longitude: Number,
          },
        ],
      },
      offline: {
        count: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 },
        devices: [
          {
            device_id: { type: Schema.Types.ObjectId, ref: "device" },
            name: String,
            serial_number: String,
            elapsed_time: Number,
            elapsed_time_readable: String,
            latitude: Number,
            longitude: Number,
          },
        ],
      },
    },
    check_type: {
      type: String,
      enum: ["hourly", "daily"],
      required: true,
      index: true,
    },
    power_metrics: {
      solar: { type: Number, default: 0 },
      mains: { type: Number, default: 0 },
      alternator: { type: Number, default: 0 },
    },
    maintenance_metrics: {
      due: { type: Number, default: 0 },
      overdue: { type: Number, default: 0 },
      unspecified: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    indexes: [
      { created_at: -1 },
      { check_type: 1 },
      { "metrics.online.count": 1 },
      { "metrics.offline.count": 1 },
    ],
  }
);

deviceStatusSchema.statics = {
  async getDeviceStatus(tenant, { startDate, endDate, limit = null }) {
    try {
      const filter = {
        created_at: {
          $gte: startDate,
          $lt: endDate,
        },
      };

      const query = this.find(filter).sort({ created_at: -1 });

      if (limit) {
        query.limit(limit);
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
        { message: error.message }
      );
    }
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
