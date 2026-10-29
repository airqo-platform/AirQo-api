const mongoose = require("mongoose");
const { Schema } = mongoose;
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");

/**
 * Cache of platform-wide usage aggregates for periods that have closed
 * (a UTC day before today, a calendar month before this one). Closed periods
 * never change, so admin dashboards read one small document instead of
 * re-aggregating the daily collection on every request.
 *
 *  period "day"   -> key "YYYY-MM-DD", data { active_users, page_views, api_calls, sessions }
 *  period "month" -> key "YYYY-MM",    data { mau, page_views, api_calls, sessions,
 *                                             lifecycle, top_pages, top_endpoints, ... }
 *
 * `scope` is "all" or "external" (staff/test accounts excluded).
 */
const UsageSummarySchema = new Schema(
  {
    tenant: { type: String, required: true, lowercase: true, trim: true },
    period: { type: String, enum: ["day", "month"], required: true },
    key: { type: String, required: true },
    scope: { type: String, enum: ["all", "external"], default: "all" },
    data: { type: Schema.Types.Mixed, default: {} },
    // Day summaries expire with the daily documents they were built from;
    // month summaries are tiny and kept so history survives compaction.
    expireAt: { type: Date },
  },
  { timestamps: true, minimize: false },
);

UsageSummarySchema.index(
  { tenant: 1, period: 1, key: 1, scope: 1 },
  { unique: true },
);
UsageSummarySchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

module.exports = (tenant) =>
  getModelByTenant(
    (tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase(),
    "usage_summary",
    UsageSummarySchema,
  );
