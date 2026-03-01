const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const moment = require("moment-timezone");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- email-log-model`);

const EmailLogSchema = new mongoose.Schema(
  {
    /**
     * Time-bucketed deduplication key for atomic exactly-once rate limiting.
     * Format: "<email>:<emailType>:<windowBucket>"
     * The unique index on this field is what prevents concurrent pods from
     * both claiming the same rate-limit slot. sparse:true allows legacy
     * records that predate this field to coexist without conflict.
     */
    bucketKey: {
      type: String,
      sparse: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    emailType: {
      type: String,
      required: true,
    },
    lastSentAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sentCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * PRIMARY index: bucketKey uniqueness enforces atomic exactly-once semantics
 * per time window per (email, emailType) pair across all Kubernetes pods.
 * The unique constraint is what turns our upsert into a distributed lock.
 */
EmailLogSchema.index({ bucketKey: 1 }, { unique: true, sparse: true });

/**
 * SECONDARY index: used by canSendEmail() for longer cooldown checks
 * (e.g., security emails with 30-day cooldown periods).
 */
EmailLogSchema.index({ email: 1, emailType: 1 });

/**
 * TTL index: automatically purge records older than 90 days to prevent
 * unbounded collection growth.
 */
EmailLogSchema.index(
  { lastSentAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
);

EmailLogSchema.statics = {
  async canSendEmail({ email, emailType, cooldownDays = 30, ip } = {}) {
    try {
      if (!email || typeof email !== "string") {
        return {
          canSend: true,
          error: "Invalid email parameter",
        };
      }

      const now = new Date();
      let cooldownDate;
      let cooldownMs;
      const isDailyLimitEmail =
        emailType === "expiringToken" || emailType === "compromisedToken";

      if (isDailyLimitEmail) {
        const todayEAT = moment().tz("Africa/Nairobi").startOf("day");
        cooldownDate = todayEAT.toDate();
        cooldownMs = now.getTime() - cooldownDate.getTime();
      } else {
        cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
        cooldownDate = new Date(now.getTime() - cooldownMs);
      }

      let query = {
        email: email.toLowerCase().trim(),
        emailType,
        lastSentAt: { $gte: cooldownDate },
      };

      if (emailType === "compromisedToken" && ip) {
        query["metadata.ip"] = ip;
      }

      const lastLog = await this.findOne(query).sort({ lastSentAt: -1 }).lean();

      if (lastLog) {
        let daysRemaining;
        let nextAvailableDate;

        if (isDailyLimitEmail) {
          const tomorrowEAT = moment(lastLog.lastSentAt)
            .tz("Africa/Nairobi")
            .startOf("day")
            .add(1, "day");
          nextAvailableDate = tomorrowEAT.toDate();
          daysRemaining = Math.ceil(
            (nextAvailableDate.getTime() - now.getTime()) /
              (24 * 60 * 60 * 1000),
          );
        } else {
          const timeSinceLastEmail = now - new Date(lastLog.lastSentAt);
          daysRemaining = Math.ceil(
            (cooldownMs - timeSinceLastEmail) / (24 * 60 * 60 * 1000),
          );
          nextAvailableDate = new Date(
            new Date(lastLog.lastSentAt).getTime() + cooldownMs,
          );
        }

        return {
          canSend: false,
          reason: isDailyLimitEmail ? "daily_limit_reached" : "cooldown_active",
          lastSentAt: lastLog.lastSentAt,
          daysRemaining,
          nextAvailableDate,
        };
      }

      return {
        canSend: true,
      };
    } catch (error) {
      logger.error(
        `Error checking email cooldown for ${emailType}/${email}: ${error.message}`,
      );
      return {
        canSend: true,
        error: error.message,
      };
    }
  },

  async logEmailSent({ email, emailType, ip, metadata = {} } = {}) {
    try {
      if (!email || typeof email !== "string") {
        return {
          success: false,
          error: "Invalid email parameter",
        };
      }

      const logMetadata = { ...metadata };
      if (emailType === "compromisedToken" && ip) {
        logMetadata.ip = ip;
      }

      const filter = {
        email: email.toLowerCase().trim(),
        emailType,
      };

      const update = {
        $set: {
          lastSentAt: new Date(),
          metadata: logMetadata,
        },
        $inc: {
          sentCount: 1,
        },
      };

      let result;
      try {
        result = await this.findOneAndUpdate(filter, update, {
          upsert: true,
          new: true,
        });
      } catch (upsertErr) {
        const isDuplicateKey =
          upsertErr.code === 11000 ||
          (upsertErr.message && upsertErr.message.includes("E11000"));

        if (!isDuplicateKey) {
          throw upsertErr;
        }

        result = await this.findOneAndUpdate(filter, update, {
          upsert: false,
          new: true,
        });

        if (!result) {
          logger.warn(
            `logEmailSent: failed to find document after E11000 retry for ${emailType}/${email}`,
          );
        }
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      logger.error(
        `Error logging email send for ${emailType}/${email}: ${error.message}`,
      );

      return {
        success: false,
        error: error.message,
      };
    }
  },
};

const EmailLogModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  return getModelByTenant(dbTenant, "email_log", EmailLogSchema);
};

module.exports = EmailLogModel;
