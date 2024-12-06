const mongoose = require("mongoose");
const { Schema } = mongoose;
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const logger = require("@utils/logger");

const networkUptimeSchema = new Schema(
  {
    created_at: {
      type: Date,
      required: true,
      index: true,
    },
    network_name: { type: String },
    uptime: { type: Number },
  },
  {
    timestamps: true,
  }
);

networkUptimeSchema.statics = {
  async getNetworkUptime(tenant, { startDate, endDate }) {
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
          $project: {
            _id: { $toString: "$_id" },
            created_at: {
              $dateToString: {
                date: "$created_at",
                format: "%Y-%m-%dT%H:%M:%S%z",
                timezone: "Africa/Kampala",
              },
            },
            network_name: 1,
            uptime: 1,
          },
        },
      ];

      const results = await this.aggregate(pipeline);

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
        { message: error.message }
      );
    }
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
