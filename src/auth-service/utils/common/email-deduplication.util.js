const crypto = require("crypto");
const SentEmailLogModel = require("@models/SentEmailLog");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- email-deduplication`,
);

class EmailDeduplicator {
  constructor(options = {}) {
    this.ttlSeconds = options.ttlSeconds || 300;
    this.keyPrefix = options.keyPrefix || "email_dedup";
    this.enableMetrics = options.enableMetrics || false;
    this.metrics = {
      duplicatesBlocked: 0,
      emailsSent: 0,
      dbErrors: 0,
      lastResetTime: new Date(),
    };
  }

  getMetrics(reset = false) {
    const currentMetrics = { ...this.metrics };
    if (reset) {
      this.metrics = {
        duplicatesBlocked: 0,
        emailsSent: 0,
        dbErrors: 0,
        lastResetTime: new Date(),
      };
    }
    return currentMetrics;
  }

  generateEmailKey(emailData) {
    const { to, subject, html, text } = emailData;
    const normalizedTo = to.toLowerCase().trim();
    const normalizedSubject = subject.trim().replace(/\s+/g, " ");
    const content = html || text || "";
    const contentHash = crypto
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .substring(0, 16);
    const compositeString = `${normalizedTo}:${normalizedSubject}:${contentHash}`;
    const keyHash = crypto
      .createHash("sha256")
      .update(compositeString)
      .digest("hex");
    return `${this.keyPrefix}:${keyHash}`;
  }

  /**
   * Atomically check if an email was recently sent and mark it as sent if not.
   * Uses MongoDB's unique index as the distributed lock — safe across multiple pods.
   *
   * @returns {Promise<boolean>} true = send the email, false = duplicate, skip it
   */
  async checkAndMarkEmail(emailData) {
    try {
      const key = this.generateEmailKey(emailData);
      const SentEmailLog = SentEmailLogModel("airqo");

      // Atomic insert: succeeds only if `hash` is unique.
      // A duplicate key error (11000) means the email was already sent recently.
      await new SentEmailLog({ hash: key }).save();

      if (this.enableMetrics) this.metrics.emailsSent++;
      return true; // New email — proceed with sending
    } catch (error) {
      if (error.code === 11000) {
        // Duplicate key — this email was already sent within the TTL window
        if (this.enableMetrics) this.metrics.duplicatesBlocked++;
        logger.info(
          `Duplicate email blocked: ${emailData.to} — ${emailData.subject}`,
        );
        return false;
      }

      // Any other DB error: fail open so critical alerts are never silently dropped
      if (this.enableMetrics) this.metrics.dbErrors++;
      logger.error(
        `DB deduplication check failed, failing open to allow email: ${error.message}`,
        { to: emailData.to, subject: emailData.subject },
      );
      return true;
    }
  }

  /**
   * Remove a deduplication key — useful for testing or manual overrides.
   * @returns {Promise<boolean>}
   */
  async removeEmailKey(emailData) {
    try {
      const key = this.generateEmailKey(emailData);
      const SentEmailLog = SentEmailLogModel("airqo");
      const result = await SentEmailLog.deleteOne({ hash: key });
      return result.deletedCount > 0;
    } catch (error) {
      logger.error(`Error removing deduplication key: ${error.message}`);
      return false;
    }
  }
}

const emailDeduplicator = new EmailDeduplicator({
  ttlSeconds: 300,
  keyPrefix: "airqo_email_dedup",
  enableMetrics: true,
});

// NOTE: sendMailWithDeduplication is intentionally not exported.
// All call sites in mailer.util.js use emailDeduplicator.checkAndMarkEmail() directly.
module.exports = { EmailDeduplicator, emailDeduplicator };
