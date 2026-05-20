const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");

const ApiUsageCounterSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    period: {
      type: String,
      enum: ["hourly", "daily", "monthly"],
      required: true,
    },
    // Sortable string key that identifies the window:
    // hourly  → "YYYYMMDDHH"   e.g. "2026052014"
    // daily   → "YYYYMMDD"     e.g. "20260520"
    // monthly → "YYYYMM"       e.g. "202605"
    window_key: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    // TTL field — MongoDB removes the document automatically after this date.
    expires_at: {
      type: Date,
      required: true,
    },
  },
  { timestamps: false }
);

// Unique compound index — one document per user per period per window.
ApiUsageCounterSchema.index(
  { user_id: 1, period: 1, window_key: 1 },
  { unique: true }
);

// TTL index — MongoDB deletes documents once expires_at is in the past.
ApiUsageCounterSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = (tenant) =>
  getModelByTenant(tenant, "api_usage_counter", ApiUsageCounterSchema);
