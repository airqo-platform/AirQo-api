const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const moment = require("moment-timezone");

const EmailLogSchema = new mongoose.Schema(
  {
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
      enum: ["compromisedToken", "expiredToken", "expiringToken"],
      index: true,
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
    },
  },
  {
    timestamps: true,
  }
);

EmailLogSchema.index({ email: 1, emailType: 1 });

EmailLogSchema.index(
  { lastSentAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }
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
        // For expiring and compromised tokens, check if an email was sent *today* (EAT timezone)
        const todayEAT = moment().tz("Africa/Nairobi").startOf("day");
        cooldownDate = todayEAT.toDate();
        cooldownMs = now.getTime() - cooldownDate.getTime();
      } else {
        // For other security emails, use the standard cooldown period
        cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
        cooldownDate = new Date(now.getTime() - cooldownMs);
      }

      let query = {
        email: email.toLowerCase().trim(),
        emailType,
        lastSentAt: { $gte: cooldownDate },
      };

      // For compromised tokens, also check the IP address in the metadata
      if (emailType === "compromisedToken" && ip) {
        query["metadata.ip"] = ip;
      }

      const lastLog = await this.findOne(query).sort({ lastSentAt: -1 }).lean();

      if (lastLog) {
        let daysRemaining = 0;
        if (!isDailyLimitEmail) {
          const timeSinceLastEmail = now - new Date(lastLog.lastSentAt);
          daysRemaining = Math.ceil(
            (cooldownMs - timeSinceLastEmail) / (24 * 60 * 60 * 1000)
          );
        }

        return {
          canSend: false,
          reason: isDailyLimitEmail ? "daily_limit_reached" : "cooldown_active",
          lastSentAt: lastLog.lastSentAt,
          daysRemaining,
          nextAvailableDate: new Date(
            new Date(lastLog.lastSentAt).getTime() + cooldownMs
          ),
        };
      }

      return {
        canSend: true,
      };
    } catch (error) {
      console.error(`Error checking email cooldown: ${error.message}`);
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

      const result = await this.findOneAndUpdate(
        {
          email: email.toLowerCase().trim(),
          emailType,
        },
        {
          $set: {
            lastSentAt: new Date(),
            metadata: logMetadata,
          },
          $setOnInsert: {
            sentCount: 0,
          },
          $inc: {
            sentCount: 1,
          },
        },
        {
          upsert: true,
          new: true,
        }
      );

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error(`Error logging email send: ${error.message}`);
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
