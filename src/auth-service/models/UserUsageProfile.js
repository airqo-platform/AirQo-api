const mongoose = require("mongoose");
const { Schema } = mongoose;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");

/**
 * One small document per (tenant, user): first/last time usage was recorded
 * and lifetime totals. Powers "last seen", new-vs-returning lifecycle and
 * signup-cohort retention without scanning the daily collection.
 */
const UserUsageProfileSchema = new Schema(
  {
    tenant: { type: String, required: true, lowercase: true, trim: true },
    user_id: { type: Schema.Types.ObjectId, required: true },
    first_seen: { type: Date },
    last_seen: { type: Date },
    total_page_views: { type: Number, default: 0 },
    total_api_calls: { type: Number, default: 0 },
    internal: { type: Boolean, default: false },
  },
  { timestamps: false },
);

UserUsageProfileSchema.index({ tenant: 1, user_id: 1 }, { unique: true });
UserUsageProfileSchema.index({ tenant: 1, first_seen: 1 });
UserUsageProfileSchema.index({ tenant: 1, last_seen: -1 });

module.exports = (tenant) =>
  getModelByTenant(
    (tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase(),
    "user_usage_profile",
    UserUsageProfileSchema,
  );
