const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

/**
 * SystemConfig — durable, admin-editable key/value configuration store.
 *
 * Distinct from ComputedCache (which has a mandatory TTL and is explicitly
 * an ephemeral cache for expensive computed results): documents here persist
 * indefinitely until explicitly deleted. First consumer is the "aqi_ranges"
 * key (see utils/aqi.util.js's resolveActiveAqiRanges), letting AQI category
 * boundaries/colors be changed via API instead of a code change + redeploy.
 *
 * `updated_by` is free text, not a verified identity — device-registry has
 * no real per-user auth (write access is gated by a shared admin secret, see
 * requireAdminSecret in validators/aqi.validators.js), so this can only ever
 * record what the caller optionally claims, not a confirmed identity.
 */
const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    updated_by: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

systemConfigSchema.statics.upsert = async function(key, value, updated_by) {
  return this.findOneAndUpdate(
    { key },
    { $set: { value, updated_by }, $inc: { version: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const SystemConfigModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  // getModelByTenant registers models on a tenant-specific connection (via
  // connection.model(), not the global mongoose.model() registry), so a
  // preceding `mongoose.model("systemconfigs")` lookup here would never
  // succeed and always fall through — it's dead code, not a real cache.
  return getModelByTenant(dbTenant, "systemconfig", systemConfigSchema);
};

module.exports = SystemConfigModel;
