const crypto = require("crypto");
const OpsAlertLogModel = require("@models/OpsAlertLog");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- ops-alert-dedup`,
);

class OpsAlertDeduplicator {
  constructor(options = {}) {
    this.ttlSeconds = options.ttlSeconds || 3600;
    this.keyPrefix = options.keyPrefix || "ops_alert_dedup";
  }

  generateAlertKey(identifier) {
    const keyHash = crypto
      .createHash("sha256")
      .update(String(identifier))
      .digest("hex");
    return `${this.keyPrefix}:${keyHash}`;
  }

  /**
   * Atomically check whether an alert for this identifier was already sent
   * within the cooldown window, and mark it sent if not. Uses MongoDB's
   * unique index as the distributed lock — safe across multiple pods.
   *
   * @param {string} identifier - Whatever uniquely identifies this alert
   *   (e.g. a Paddle transaction id) — repeated calls with the same
   *   identifier within the TTL window are treated as duplicates.
   * @param {object} [opts]
   * @param {string} [opts.tenant]        - Tenant to scope the log collection
   * @param {number} [opts.ttlSeconds]    - Cooldown window (default: class ttlSeconds)
   * @returns {Promise<boolean>} true = send the alert, false = duplicate, skip it
   */
  async shouldAlert(identifier, { tenant, ttlSeconds } = {}) {
    try {
      const key = this.generateAlertKey(identifier);
      const OpsAlertLog = OpsAlertLogModel(tenant);
      const effectiveTtl = ttlSeconds ?? this.ttlSeconds;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + effectiveTtl * 1000);

      // Atomic renew-or-create: the filter only matches a document that
      // doesn't exist yet, or whose cooldown has already logically expired.
      // This doesn't rely on Mongo's TTL monitor having physically deleted
      // the stale doc yet (that sweep runs periodically, e.g. every ~60s,
      // and can lag behind `expiresAt`) — expiry is evaluated here instead.
      // If a still-active document exists, the filter won't match it, so the
      // upsert's insert attempt collides with the unique index instead;
      // that E11000 is read as "still within cooldown, suppress".
      await OpsAlertLog.findOneAndUpdate(
        { hash: key, expiresAt: { $lte: now } },
        { $set: { hash: key, createdAt: now, expiresAt } },
        { upsert: true },
      );
      return true;
    } catch (error) {
      if (error.code === 11000) {
        logger.info(`Duplicate ops alert suppressed for: ${identifier}`);
        return false;
      }

      // Any other DB error: fail open so real alerts are never silently dropped.
      logger.error(
        `DB dedup check failed, failing open to allow alert: ${error.message}`,
        { identifier },
      );
      return true;
    }
  }
}

const opsAlertDeduplicator = new OpsAlertDeduplicator({
  ttlSeconds: 3600,
  keyPrefix: "airqo_ops_alert_dedup",
});

module.exports = { OpsAlertDeduplicator, opsAlertDeduplicator };
