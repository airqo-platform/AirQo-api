const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

const SentEmailLogSchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 300, // TTL: auto-delete after 5 minutes
    },
  },
  { timestamps: false },
);

const SentEmailLogModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant.toLowerCase();
  try {
    return mongoose.model("sent_email_logs");
  } catch (error) {
    return getModelByTenant(dbTenant, "sent_email_log", SentEmailLogSchema);
  }
};

module.exports = SentEmailLogModel;
