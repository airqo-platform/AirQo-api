const mongoose = require("mongoose");
const { Schema } = mongoose;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");

/**
 * One document per (tenant, user, UTC day). Everything is a pre-aggregated
 * counter written with $inc upserts, so the collection grows with active
 * user-days, never with request volume.
 *
 *  pages        { "<page template>":   { n: views, d: seconds on page } }
 *  api          { "<METHOD /api/...>": calls }
 *  page_hours / api_hours   { "<0-23 UTC hour>": count }   (sparse)
 *
 * Map keys are sanitised by the recorder (no "." or leading "$"), so plain
 * Mixed objects are safe. The breakdown maps (`pages`, `api`) are unset by the
 * usage-rollup job once a document is older than USAGE_DETAIL_RETENTION_MONTHS;
 * totals and hourly histograms are kept until the TTL removes the document.
 */
const UserUsageDailySchema = new Schema(
  {
    tenant: { type: String, required: true, lowercase: true, trim: true },
    user_id: { type: Schema.Types.ObjectId, required: true },
    // "YYYY-MM-DD" (UTC). Lexically sortable, so range queries stay simple.
    day: { type: String, required: true },
    page_views: { type: Number, default: 0 },
    api_calls: { type: Number, default: 0 },
    // Sessions started that day (client flags the first event of a session).
    sessions: { type: Number, default: 0 },
    // Sum of page dwell time, in seconds.
    duration_sec: { type: Number, default: 0 },
    pages: { type: Schema.Types.Mixed, default: undefined },
    api: { type: Schema.Types.Mixed, default: undefined },
    page_hours: { type: Schema.Types.Mixed, default: undefined },
    api_hours: { type: Schema.Types.Mixed, default: undefined },
    // Staff/test accounts (USAGE_INTERNAL_EMAIL_DOMAINS), fixed at first write.
    internal: { type: Boolean, default: false },
    // Set on documents created by the historical backfill; their counts are
    // placed at 12:00 UTC because the source data has no hour resolution.
    backfilled: { type: Boolean, default: undefined },
    expireAt: { type: Date, required: true },
  },
  { timestamps: false, minimize: false },
);

UserUsageDailySchema.index({ tenant: 1, user_id: 1, day: 1 }, { unique: true });
// Platform-wide aggregations scan a day range across all users.
UserUsageDailySchema.index({ tenant: 1, day: 1 });
UserUsageDailySchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = (tenant) =>
  getModelByTenant(
    (tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase(),
    "user_usage_daily",
    UserUsageDailySchema,
  );
