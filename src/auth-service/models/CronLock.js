const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

/**
 * Distributed lock for cron jobs that run independently on every pod replica
 * (this deployment has no leader election). A unique index on `lockKey`
 * enforces first-writer-wins: the pod whose insert succeeds got the lock,
 * every other pod's insert fails with E11000. See utils/common/cron-lock.util.js
 * for the acquire helper.
 */
const CronLockSchema = new mongoose.Schema(
  {
    lockKey: {
      type: String,
      required: true,
    },
  },
  { timestamps: true },
);

CronLockSchema.index({ lockKey: 1 }, { unique: true });

// TTL: locks expire after 24h so a crashed/never-run job can't wedge future
// runs. Legitimate locks are always superseded by the next minute's bucket
// long before this fires.
CronLockSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

const CronLockModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  return getModelByTenant(dbTenant, "cron_lock", CronLockSchema);
};

module.exports = CronLockModel;
