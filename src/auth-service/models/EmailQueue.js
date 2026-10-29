const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

const EmailQueueSchema = new mongoose.Schema(
  {
    mailOptions: {
      type: Object,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "failed"],
      default: "pending",
      index: true,
    },
    tenant: {
      type: String,
      required: true,
      default: "airqo",
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
    },
    // Opt-in context a caller can attach when queuing (e.g. functionName,
    // userId, fingerprint) so the queue processor can react to a permanent
    // delivery failure — e.g. rolling back a security notification's side
    // effect so it is retried on the next trigger instead of being silently
    // dropped forever.
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true },
);

EmailQueueSchema.index({ status: 1, lastAttemptAt: 1 });

const EmailQueueModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  return getModelByTenant(dbTenant, "email_queue", EmailQueueSchema);
};

module.exports = EmailQueueModel;
