const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const moment = require("moment-timezone");
const { getModelByTenant } = require("@config/database");

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- log-throttle-model`
);

const logThrottleSchema = new Schema(
  {
    lock_key: { type: String, required: true, unique: true, trim: true },
    logType: {
      type: String,
      required: [true, "logType is required!"],
      trim: true,
    },
    environment: {
      type: String,
      required: [true, "environment is required!"],
      trim: true,
    },
    last_run_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "log_throttles",
  }
);

// Create compound unique index for efficient queries and prevent duplicates
logThrottleSchema.index({ lock_key: 1 }, { unique: true });

// TTL index - automatically delete documents after a configurable period
logThrottleSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: (constants.LOG_THROTTLE_TTL_DAYS || 7) * 24 * 60 * 60, // Default to 7 days
    name: "log_throttle_ttl_idx",
    background: true,
  }
);

// Instance methods
logThrottleSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      lock_key: this.lock_key,
      logType: this.logType,
      last_run_at: this.last_run_at,
      environment: this.environment,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const LogThrottleModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    // Check if model is already registered
    const throttles = mongoose.model("log_throttles");
    return throttles;
  } catch (error) {
    // If not, register it
    return getModelByTenant(dbTenant, "log_throttle", logThrottleSchema);
  }
};

module.exports = LogThrottleModel;
