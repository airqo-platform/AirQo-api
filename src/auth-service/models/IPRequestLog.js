const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const { logObject } = require("@utils/shared");

const IPRequestLogSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      index: true,
    },
    requests: [
      {
        timestamp: { type: Date, required: true },
        endpoint: { type: String, required: true },
      },
    ],
    isUnderWatch: {
      type: Boolean,
      default: true,
    },
    isBot: {
      type: Boolean,
      default: false,
    },
    detectedInterval: {
      type: Number, // in minutes
    },
  },
  { timestamps: true }
);

IPRequestLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL
IPRequestLogSchema.index({ ip: 1, "requests.timestamp": -1 });

IPRequestLogSchema.statics = {
  async recordRequest({ ip, endpoint } = {}) {
    try {
      if (!ip || !endpoint) {
        return {
          success: false,
          message: "ip and endpoint are required",
        };
      }

      const ipLog = await this.findOneAndUpdate(
        { ip },
        {
          $push: {
            requests: {
              $each: [{ timestamp: new Date(), endpoint }],
              $slice: -100, // Keep only the last 100 requests
            },
          },
          $set: { isUnderWatch: true },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return {
        success: true,
        data: ipLog,
      };
    } catch (error) {
      logObject("Error recording IP request", error);
      return {
        success: false,
        message: "Error recording IP request",
        error: error.message,
      };
    }
  },
  async getRequests(ip) {
    try {
      const ipLog = await this.findOne({ ip }).lean();
      return ipLog ? ipLog.requests : [];
    } catch (error) {
      logObject("Error getting IP requests", error);
      return [];
    }
  },
  async markAsBot(ip, interval) {
    try {
      await this.updateOne(
        { ip },
        {
          $set: {
            isBot: true,
            isUnderWatch: false,
            detectedInterval: interval,
          },
        }
      );
      return { success: true };
    } catch (error) {
      logObject("Error marking IP as bot", error);
      return { success: false, error: error.message };
    }
  },
};

const IPRequestLogModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  return getModelByTenant(dbTenant, "ip_request_log", IPRequestLogSchema);
};

module.exports = IPRequestLogModel;
