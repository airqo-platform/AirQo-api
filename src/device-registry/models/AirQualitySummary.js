const mongoose = require("mongoose");
const { getSnapshotModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

/**
 * AirQualitySummary — permanent running PM2.5 aggregate per {tenant, level, entity, year}.
 *
 * Raw readings are purged from MongoDB after ~14 days (see the TTL indexes on
 * Reading.time / Reading.createdAt), so a live aggregation over a multi-year
 * window can only ever see the last ~2 weeks. air-quality-rollup-job.js runs
 * daily and folds each new day's readings into these running totals *before*
 * the source documents are purged — this collection is the only place true
 * multi-year history survives. Unlike CohortDeviceSnapshot (an ephemeral
 * "current state" cache with a 25h TTL), these rows are durable and never expire:
 * a closed year's totals are historical fact, not a snapshot that goes stale.
 *
 * avg_pm2_5 is deliberately NOT stored — it's derived at read time as
 * sum_pm2_5 / reading_count, so the running totals stay the single source of
 * truth and there's nothing to keep in sync.
 */
const airQualitySummarySchema = new mongoose.Schema(
  {
    tenant: {
      type: String,
      required: true,
    },
    level: {
      type: String,
      required: true,
      enum: ["country", "city"],
    },
    entity: {
      type: String,
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
    sum_pm2_5: {
      type: Number,
      required: true,
      default: 0,
    },
    reading_count: {
      type: Number,
      required: true,
      default: 0,
    },
    // Deduped via $addToSet as the job processes each day's delta window.
    contributing_sites: {
      type: [String],
      default: [],
    },
    last_updated_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Unique compound key used for upserts in air-quality-rollup-job.js
airQualitySummarySchema.index(
  { tenant: 1, level: 1, entity: 1, year: 1 },
  { unique: true }
);

// Matches the read pattern: fetch all entities for a level across a year range
airQualitySummarySchema.index({ tenant: 1, level: 1, year: 1 });

const AirQualitySummaryModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  return getSnapshotModelByTenant(
    dbTenant,
    "airqualitysummary",
    airQualitySummarySchema
  );
};

module.exports = AirQualitySummaryModel;
