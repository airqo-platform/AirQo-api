// src/auth-service/models/EmailLog.js
const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

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
      enum: [
        "compromisedToken",
        "expiredToken",
        "expiringToken",
        // Add other types as needed
      ],
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
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient lookups
EmailLogSchema.index({ email: 1, emailType: 1 });

// TTL index to auto-cleanup old records (optional, keeps DB clean)
EmailLogSchema.index(
  { lastSentAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 }
); // 90 days

EmailLogSchema.statics = {
  async canSendEmail({ email, emailType, cooldownDays = 30 } = {}) {
    try {
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const now = new Date();
      const cooldownDate = new Date(now.getTime() - cooldownMs);

      const lastLog = await this.findOne({
        email: email.toLowerCase().trim(),
        emailType,
        lastSentAt: { $gte: cooldownDate },
      })
        .sort({ lastSentAt: -1 })
        .lean();

      if (lastLog) {
        const timeSinceLastEmail = now - new Date(lastLog.lastSentAt);
        const daysRemaining = Math.ceil(
          (cooldownMs - timeSinceLastEmail) / (24 * 60 * 60 * 1000)
        );

        return {
          canSend: false,
          reason: "cooldown_active",
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
      // On error, fail open (allow sending) to avoid blocking critical emails
      console.error(`Error checking email cooldown: ${error.message}`);
      return {
        canSend: true,
        error: error.message,
      };
    }
  },

  async logEmailSent({ email, emailType, metadata = {} } = {}) {
    try {
      const result = await this.findOneAndUpdate(
        {
          email: email.toLowerCase().trim(),
          emailType,
        },
        {
          $set: {
            lastSentAt: new Date(),
            metadata,
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
