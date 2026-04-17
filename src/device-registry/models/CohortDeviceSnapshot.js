const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

/**
 * CohortDeviceSnapshot — flat pre-computed collection for fast cohort device reads.
 *
 * Each document represents one enriched device record for a specific cohort. The
 * data is exactly what POST /cohorts/devices returns, written here by the hourly
 * cohort-snapshot-job. The live endpoint POST /cohorts/cached-devices then serves
 * these documents with a simple find(), skip(), limit() — no aggregation required.
 *
 * Indexed filter fields (name, isOnline, status, category, network) are lifted to
 * the top level so queries can use indexes. The full enriched device document is
 * stored in the `data` field and returned as-is to the caller.
 *
 * TTL: documents auto-expire after 25 hours if the job fails to refresh them.
 */
const cohortDeviceSnapshotSchema = new mongoose.Schema(
  {
    cohort_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    device_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    tenant: {
      type: String,
      required: true,
    },
    // Top-level filter fields — copies from device data to support indexed queries
    name: { type: String },
    isOnline: { type: Boolean },
    status: { type: String },
    category: { type: String },
    network: { type: String },
    // Full enriched device document as returned by listDevices
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // When this snapshot document was last computed
    _snapshot_generated_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    // Fail immediately when no connection is available instead of buffering for
    // bufferTimeoutMS (10 s). The snapshot job and cached endpoints both have
    // explicit error handling / fallback logic, so a fast failure is preferable
    // to a silent 10 s hang under connection pool pressure.
    bufferCommands: false,
  }
);

// Unique compound key used for upserts in the snapshot job
cohortDeviceSnapshotSchema.index(
  { cohort_id: 1, device_id: 1, tenant: 1 },
  { unique: true }
);

// Support search on name within a cohort
cohortDeviceSnapshotSchema.index({ cohort_id: 1, tenant: 1, name: 1 });

// Support isOnline filter within a cohort
cohortDeviceSnapshotSchema.index({ cohort_id: 1, tenant: 1, isOnline: 1 });

// Support status / category / network filters within a cohort
cohortDeviceSnapshotSchema.index({ cohort_id: 1, tenant: 1, status: 1 });
cohortDeviceSnapshotSchema.index({ cohort_id: 1, tenant: 1, category: 1 });
cohortDeviceSnapshotSchema.index({ cohort_id: 1, tenant: 1, network: 1 });

// Auto-expire stale documents after 25 hours (safety net if the job stops running)
cohortDeviceSnapshotSchema.index(
  { _snapshot_generated_at: 1 },
  { expireAfterSeconds: 90000 }
);

const CohortDeviceSnapshotModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("cohortdevicesnapshot");
  } catch (error) {
    return getModelByTenant(
      dbTenant,
      "cohortdevicesnapshot",
      cohortDeviceSnapshotSchema
    );
  }
};

module.exports = CohortDeviceSnapshotModel;
