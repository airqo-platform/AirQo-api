"use strict";
const mongoose = require("mongoose");
const { Schema } = mongoose;
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");

// Fields that are permitted in updateData — mirrors validateBulkUpdateDevices allowlist.
const ALLOWED_UPDATE_FIELDS = [
  "groups",
  "mobility",
  "owner",
  "description",
  "product_name",
  "device_manufacturer",
  "category",
  "collocation",
];

// Device fields that are safe to use as filter criteria.
// $-prefixed operators are separately blocked at the validator layer.
const ALLOWED_FILTER_FIELDS = [
  "network",
  "category",
  "status",
  "deployment_type",
  "mobility",
  "isActive",
  "owner",
  "device_manufacturer",
  "product_name",
  "long_name",
  "device_number",
];

const DeviceBulkUpdateJobSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    tenant: {
      type: String,
      required: true,
      default: constants.DEFAULT_TENANT || "airqo",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed", "paused", "cancelled"],
      default: "pending",
      index: true,
    },
    // MongoDB filter that determines which devices are targeted.
    // Stored as Mixed; validated at the API layer before persisting.
    filter: {
      type: Schema.Types.Mixed,
      required: true,
    },
    // The $set payload — only allowlisted fields reach here.
    updateData: {
      type: Schema.Types.Mixed,
      required: true,
    },
    batchSize: {
      type: Number,
      default: 30,
      min: 1,
      max: 100,
    },
    // When true the job logs what it would do but writes nothing.
    dryRun: {
      type: Boolean,
      default: false,
    },
    // Device ObjectIds that have already been successfully updated.
    // Used to skip them on subsequent runs — the core idempotency mechanism.
    processedIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    // Device ObjectIds whose last update attempt failed.
    failedIds: {
      type: [Schema.Types.ObjectId],
      default: [],
    },
    // Set on first run — total devices matching the filter at that point.
    totalDevices: {
      type: Number,
      default: null,
    },
    processedCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    lastRunAt: { type: Date },
    runCount: {
      type: Number,
      default: 0,
    },
    lastError: { type: String },
    createdBy: { type: String },
  },
  { timestamps: true }
);

DeviceBulkUpdateJobSchema.index({ status: 1, tenant: 1 });

// Valid category values — mirrors DEVICE_CONFIG.ALLOWED_CATEGORIES in Device.js.
// Kept here so validators import from one place rather than duplicating the list.
const ALLOWED_CATEGORIES = ["bam", "lowcost", "gas"];

// Expose allowlists as statics so validators and the job runner share one source of truth.
// NOTE: processedIds and failedIds are stored as ObjectId arrays on the job document.
// For typical fleet sizes (up to ~50 000 devices) this is well within MongoDB's 16 MB
// document limit (~12 bytes × 50 000 = ~600 KB). For larger scopes, split the job
// into multiple smaller jobs or migrate to a separate tracking collection.
DeviceBulkUpdateJobSchema.statics.ALLOWED_UPDATE_FIELDS = ALLOWED_UPDATE_FIELDS;
DeviceBulkUpdateJobSchema.statics.ALLOWED_FILTER_FIELDS = ALLOWED_FILTER_FIELDS;
DeviceBulkUpdateJobSchema.statics.ALLOWED_CATEGORIES = ALLOWED_CATEGORIES;

const DeviceBulkUpdateJobModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = tenant ? tenant.toLowerCase() : defaultTenant;
  try {
    return mongoose.model("devicebulkupdatejobs");
  } catch (error) {
    return getModelByTenant(
      dbTenant,
      "devicebulkupdatejob",
      DeviceBulkUpdateJobSchema
    );
  }
};

module.exports = DeviceBulkUpdateJobModel;
