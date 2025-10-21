const { Schema } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { logObject, logText, HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- query-throttle-model`
);

const RATE_LIMIT_DEFAULT_TTL = 360;

const QueryThrottleSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    timestamp: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["ancient_block", "rate_limit", "block_log"],
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: false,
    collection: "query_throttle_logs",
  }
);

QueryThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
QueryThrottleSchema.index({ key: 1 }, { unique: true });
QueryThrottleSchema.index({ type: 1 });

QueryThrottleSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

QueryThrottleSchema.statics.getThrottle = async function(key) {
  try {
    const record = await this.findOne({
      key,
      expiresAt: { $gt: new Date() },
    }).lean();
    return record;
  } catch (error) {
    logger.error(`Error getting throttle: ${error.message}`);
    return null;
  }
};

QueryThrottleSchema.statics.setThrottle = async function(
  key,
  type,
  ttlSeconds,
  metadata = {}
) {
  try {
    const now = Date.now();
    const expiresAt = new Date(now + ttlSeconds * 1000);

    await this.findOneAndUpdate(
      { key },
      {
        key,
        timestamp: now,
        type,
        expiresAt,
        metadata,
      },
      { upsert: true, new: true }
    );
    return true;
  } catch (error) {
    logger.error(`Error setting throttle: ${error.message}`);
    return false;
  }
};

QueryThrottleSchema.statics.getRateLimitTracker = async function(clientId) {
  try {
    const record = await this.findOne({
      key: `rate-limit-${clientId}`,
      type: "rate_limit",
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!record) {
      return { count: 0, windowStart: Date.now(), blockedUntil: 0 };
    }

    return {
      count: record.metadata.count || 0,
      windowStart: record.metadata.windowStart || Date.now(),
      blockedUntil: record.metadata.blockedUntil || 0,
    };
  } catch (error) {
    logger.error(`Error getting rate limit tracker: ${error.message}`);
    return { count: 0, windowStart: Date.now(), blockedUntil: 0 };
  }
};

QueryThrottleSchema.statics.setRateLimitTracker = async function(
  clientId,
  tracker
) {
  try {
    const ttl =
      tracker.blockedUntil > Date.now()
        ? Math.ceil((tracker.blockedUntil - Date.now()) / 1000) + 60
        : RATE_LIMIT_DEFAULT_TTL;

    await this.setThrottle(
      `rate-limit-${clientId}`,
      "rate_limit",
      ttl,
      tracker
    );
    return true;
  } catch (error) {
    logger.error(`Error setting rate limit tracker: ${error.message}`);
    return false;
  }
};

QueryThrottleSchema.statics.cleanupExpired = async function() {
  try {
    const result = await this.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    if (result.deletedCount > 0) {
      logger.info(`Cleaned up ${result.deletedCount} expired throttle records`);
    }
    return result.deletedCount;
  } catch (error) {
    logger.error(`Error cleaning up expired records: ${error.message}`);
    return 0;
  }
};

const QueryThrottleModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const query_throttle_logs = mongoose.model("query_throttle_logs");
    return query_throttle_logs;
  } catch (error) {
    const query_throttle_logs = getModelByTenant(
      dbTenant,
      "query_throttle_log",
      QueryThrottleSchema
    );
    return query_throttle_logs;
  }
};

module.exports = QueryThrottleModel;
