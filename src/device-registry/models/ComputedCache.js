const mongoose = require("mongoose");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const isEmpty = require("is-empty");

/**
 * ComputedCache — lightweight MongoDB-backed key/value store for
 * expensive aggregation results that need to survive pod restarts and be
 * shared across all Kubernetes replicas.
 *
 * Why MongoDB instead of in-memory?
 *   - In-memory caches are pod-local: each replica maintains its own copy,
 *     so every pod independently pays the aggregation cost on its first miss.
 *   - Pod restarts (rolling deploys, OOM kills, evictions) reset in-memory
 *     caches, causing a cold-start spike on every replacement pod.
 *   - A single MongoDB document is shared by all replicas. Once any one pod
 *     writes it, all other pods benefit immediately on their next L2 read.
 *
 * Usage pattern (two-level cache):
 *   1. Check L1 (in-memory)  → hit: return instantly
 *   2. Check L2 (this model) → hit: populate L1, return
 *   3. Both miss             → run expensive query, write to L2 + L1, return
 *
 * TTL: the `expiresAt` field carries a MongoDB TTL index so expired documents
 * are cleaned up automatically. The application also checks `expiresAt` before
 * trusting a document, so the effective TTL is controlled at the call site.
 */
const computedCacheSchema = new mongoose.Schema(
  {
    // Logical name of the cached computation, e.g. "private_site_ids"
    key: {
      type: String,
      required: true,
    },
    // Tenant this cache entry belongs to
    tenant: {
      type: String,
      required: true,
    },
    // The cached payload — any serialisable value
    data: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    // When the computation was last run
    computedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    // MongoDB TTL index field — document is automatically deleted after this
    // timestamp. Acts as a server-side safety net so stale entries never
    // accumulate even if the application logic skips a recompute cycle.
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: false }
);

// One document per (key, tenant) pair
computedCacheSchema.index({ key: 1, tenant: 1 }, { unique: true });

// MongoDB removes the document automatically once expiresAt is in the past
computedCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ComputedCacheModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("computedcaches");
  } catch (error) {
    return getModelByTenant(dbTenant, "computedcache", computedCacheSchema);
  }
};

module.exports = ComputedCacheModel;
