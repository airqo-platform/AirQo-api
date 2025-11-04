// /Users/balmart/Documents/github/AirQo-api/src/auth-service/models/EmailQueue.js
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
  },
  { timestamps: true }
);

EmailQueueSchema.index({ status: 1, lastAttemptAt: 1 });

const EmailQueueModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  try {
    return mongoose.model("email_queues");
  } catch (error) {
    return getModelByTenant(dbTenant, "email_queue", EmailQueueSchema);
  }
};

module.exports = EmailQueueModel;
