const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

const SentEmailLogSchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      required: true,
      unique: true, // unique: true already creates an index; index: true is redundant and removed
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    // Per-document TTL: MongoDB deletes the document when this date is reached.
    // expireAfterSeconds: 0 means "delete at the moment stored in this field",
    // allowing each document to carry its own retention window.
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
  },
  { timestamps: false },
);

const SentEmailLogModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant.toLowerCase();

  return getModelByTenant(dbTenant, "sent_email_log", SentEmailLogSchema);
};

module.exports = SentEmailLogModel;
