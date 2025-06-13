// models/MigrationTracker.js
const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");

const migrationTrackerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    tenant: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

migrationTrackerSchema.index({ name: 1, tenant: 1 }, { unique: true });

const MigrationTrackerModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = tenant || defaultTenant;

  try {
    const migrationTracker = mongoose.model("migrationTrackers");
    return migrationTracker;
  } catch (errors) {
    return getModelByTenant(
      dbTenant.toLowerCase(),
      "migrationTracker",
      migrationTrackerSchema
    );
  }
};

module.exports = MigrationTrackerModel;
