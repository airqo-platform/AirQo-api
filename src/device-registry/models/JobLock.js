// src/device-registry/models/JobLock.js
const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

const jobLockSchema = new mongoose.Schema({
  // Unique job identifier — one document per job name
  jobName: {
    type: String,
    required: true,
    unique: true,
  },
  // Which pod acquired the lock — useful for debugging
  acquiredBy: {
    type: String,
    required: true,
  },
  acquiredAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  // TTL field — MongoDB automatically deletes this document
  // after the specified number of seconds if it is not manually
  // released first. Acts as a dead-man's switch for crashed pods.
  expiresAt: {
    type: Date,
    required: true,
  },
});

// MongoDB TTL index — automatically removes expired lock documents.
// This is the safety net: if a pod crashes without releasing the lock,
// the document is cleaned up after `expiresAt` passes so the next
// cron tick is not permanently blocked.
jobLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const JobLockModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("joblocks");
  } catch (error) {
    return getModelByTenant(dbTenant, "joblock", jobLockSchema);
  }
};

module.exports = JobLockModel;
