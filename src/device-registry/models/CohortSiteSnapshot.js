const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

/**
 * CohortSiteSnapshot — flat pre-computed collection for fast cohort site reads.
 *
 * Mirror of CohortDeviceSnapshot for sites. Each document represents one enriched
 * site record for a specific cohort, written hourly by cohort-snapshot-job and
 * served by POST /cohorts/cached-sites using a simple find() with no aggregation.
 */
const cohortSiteSnapshotSchema = new mongoose.Schema(
  {
    cohort_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    site_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    tenant: {
      type: String,
      required: true,
    },
    // Top-level filter fields
    name: { type: String },
    search_name: { type: String },
    country: { type: String },
    // Full enriched site document as returned by listSites
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    _snapshot_generated_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    // Fail immediately when no connection is available — same rationale as
    // CohortDeviceSnapshot. Both the snapshot job and cached endpoints handle
    // errors explicitly, so fast failure beats a silent 10 s buffer timeout.
    bufferCommands: false,
  }
);

cohortSiteSnapshotSchema.index(
  { cohort_id: 1, site_id: 1, tenant: 1 },
  { unique: true }
);

cohortSiteSnapshotSchema.index({ cohort_id: 1, tenant: 1, name: 1 });
cohortSiteSnapshotSchema.index({ cohort_id: 1, tenant: 1, search_name: 1 });
cohortSiteSnapshotSchema.index({ cohort_id: 1, tenant: 1, country: 1 });

cohortSiteSnapshotSchema.index(
  { _snapshot_generated_at: 1 },
  { expireAfterSeconds: 90000 }
);

const CohortSiteSnapshotModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("cohortsitesnapshot");
  } catch (error) {
    return getModelByTenant(
      dbTenant,
      "cohortsitesnapshot",
      cohortSiteSnapshotSchema
    );
  }
};

module.exports = CohortSiteSnapshotModel;
