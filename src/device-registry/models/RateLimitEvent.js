const { Schema } = require("mongoose");
const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- rate-limit-event-model`
);

// Durable log of rate-limit events, separate from QueryThrottle (which is a
// short-lived TTL cache used for the in-request rate-limit decision itself).
// Kept for 32 days so the daily digest job always has yesterday's data
// available, then auto-expires to bound collection growth.
const RATE_LIMIT_EVENT_TTL_DAYS = 32;

const RateLimitEventSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: ["TRIGGERED", "BLOCKED"],
      required: true,
      index: true,
    },
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    tenant: {
      type: String,
      lowercase: true,
      default: "airqo",
    },
    qpm: {
      type: Number,
    },
    blockedForMinutes: {
      type: Number,
    },
    remainingSeconds: {
      type: Number,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    collection: "rate_limit_events",
  }
);

RateLimitEventSchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: RATE_LIMIT_EVENT_TTL_DAYS * 24 * 60 * 60 }
);

RateLimitEventSchema.statics.recordEvent = async function(data) {
  try {
    await this.create(data);
    return true;
  } catch (error) {
    logger.error(`Error recording rate limit event: ${error.message}`);
    return false;
  }
};

RateLimitEventSchema.statics.getSummary = async function({ start, end }) {
  try {
    const results = await this.aggregate([
      {
        $match: {
          timestamp: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: "$clientId",
          triggeredCount: {
            $sum: { $cond: [{ $eq: ["$eventType", "TRIGGERED"] }, 1, 0] },
          },
          blockedCount: {
            $sum: { $cond: [{ $eq: ["$eventType", "BLOCKED"] }, 1, 0] },
          },
          maxQpm: { $max: "$qpm" },
        },
      },
      { $sort: { triggeredCount: -1, blockedCount: -1 } },
    ]).option({ allowDiskUse: true }); // guards against a large-scale, many-client attack
    return results;
  } catch (error) {
    logger.error(`Error getting rate limit summary: ${error.message}`);
    return [];
  }
};

const RateLimitEventModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const rate_limit_events = mongoose.model("rate_limit_events");
    return rate_limit_events;
  } catch (error) {
    const rate_limit_events = getModelByTenant(
      dbTenant,
      "rate_limit_event",
      RateLimitEventSchema
    );
    return rate_limit_events;
  }
};

module.exports = RateLimitEventModel;
