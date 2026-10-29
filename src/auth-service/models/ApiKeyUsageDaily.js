const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getModelByTenant } = require("@config/database");

/**
 * One document per (tenant, API client, UTC day), written by the API-key usage
 * recorder from the nginx token-verify hop. Everything is a pre-aggregated
 * counter written with $inc upserts, so the collection grows with active
 * key-days, never with request volume.
 *
 *  services  { "<service>":           calls }   e.g. analytics, devices
 *  api       { "<METHOD /api/...>":   calls }   route templates, ids folded
 *  hours     { "<0-23 UTC hour>":     calls }   (sparse)
 *  ips       { "<ip, dots as _>":     calls }   (sparse)
 *
 * A client owns exactly one access token, so client_id identifies the key.
 * Map keys are sanitised by the recorder (no "." or leading "$"). Documents
 * are removed by the TTL index after USAGE_RETENTION_MONTHS.
 */
const ApiKeyUsageDailySchema = new Schema(
  {
    tenant: { type: String, required: true, lowercase: true, trim: true },
    client_id: { type: Schema.Types.ObjectId, required: true },
    user_id: { type: Schema.Types.ObjectId, default: null },
    // "YYYY-MM-DD" (UTC). Lexically sortable, so range queries stay simple.
    day: { type: String, required: true },
    calls: { type: Number, default: 0 },
    services: { type: Schema.Types.Mixed, default: undefined },
    api: { type: Schema.Types.Mixed, default: undefined },
    hours: { type: Schema.Types.Mixed, default: undefined },
    ips: { type: Schema.Types.Mixed, default: undefined },
    first_at: { type: Date },
    last_at: { type: Date },
    last_ip: { type: String },
    expireAt: { type: Date, required: true },
  },
  { timestamps: false },
);

ApiKeyUsageDailySchema.index(
  { tenant: 1, client_id: 1, day: 1 },
  { unique: true },
);
// Range scans for the leaderboard and timeseries views.
ApiKeyUsageDailySchema.index({ tenant: 1, day: 1 });
ApiKeyUsageDailySchema.index({ user_id: 1, day: 1 });
ApiKeyUsageDailySchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = (tenant) =>
  getModelByTenant(tenant, "api_key_usage_daily", ApiKeyUsageDailySchema);
