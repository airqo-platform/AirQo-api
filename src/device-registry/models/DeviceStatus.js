const mongoose = require("mongoose");
const { Schema } = mongoose;
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const logger = require("@utils/logger");

const deviceStatusSchema = new Schema(
  {
    created_at: {
      type: Date,
      required: true,
      index: true,
    },
    // Add other fields based on your MongoDB collection structure
    // For example:
    // device_name: { type: String },
    // status: { type: String }
  },
  {
    timestamps: true,
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
