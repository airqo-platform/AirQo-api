const crypto = require("crypto");
const redisClient = require("@config/ioredis");

class EmailDeduplicator {
  constructor(options = {}) {
    this.ttlSeconds = options.ttlSeconds || 300; // 5 minutes default
    this.keyPrefix = options.keyPrefix || "email_dedup";
  }

  /**
   * Generate a unique key for email deduplication
   * @param {Object} emailData - Email parameters
   * @returns {string} - Unique key for the email
   */
  generateEmailKey(emailData) {
    const { to, subject, html, text } = emailData;

    // Normalize email address (lowercase, trim)
    const normalizedTo = to.toLowerCase().trim();

    // Normalize subject (trim, remove extra spaces)
    const normalizedSubject = subject.trim().replace(/\s+/g, " ");

    // Create hash of email content for additional uniqueness
    const content = html || text || "";
    const contentHash = crypto
      .createHash("md5")
      .update(content)
      .digest("hex")
      .substring(0, 8); // Use first 8 characters

    // Create composite key
    const compositeString = `${normalizedTo}:${normalizedSubject}:${contentHash}`;

    // Generate final key with prefix
    const keyHash = crypto
      .createHash("sha256")
      .update(compositeString)
      .digest("hex")
      .substring(0, 16);

    return `${this.keyPrefix}:${keyHash}`;
  }

  /**
   * Check if email was recently sent and mark as sent if not
   * @param {Object} emailData - Email parameters
   * @returns {Promise<boolean>} - true if email should be sent, false if duplicate
   */
  async checkAndMarkEmail(emailData) {
    try {
      const key = this.generateEmailKey(emailData);

      // Use ioredis SET with NX (only set if not exists) and EX (expiration)
      // ioredis syntax: set(key, value, 'EX', seconds, 'NX')
      const result = await redisClient.set(
        key,
        "1",
        "EX",
        this.ttlSeconds,
        "NX"
      );

      // If result is 'OK', the key was set (email not sent recently)
      // If result is null, the key already exists (duplicate email)
      return result === "OK";
    } catch (error) {
      console.error("Error in email deduplication check:", error);
      // In case of Redis error, allow email to be sent (fail open)
      return true;
    }
  }

  /**
   * Remove email from deduplication cache (for testing or manual override)
   * @param {Object} emailData - Email parameters
   * @returns {Promise<boolean>} - true if key was removed
   */
  async removeEmailKey(emailData) {
    try {
      const key = this.generateEmailKey(emailData);
      const result = await redisClient.del(key);
      return result > 0;
    } catch (error) {
      console.error("Error removing email key:", error);
      return false;
    }
  }

  /**
   * Get statistics about email deduplication
   * @returns {Promise<Object>} - Stats object
   */
  async getStats() {
    try {
      // ioredis keys method
      const keys = await redisClient.keys(`${this.keyPrefix}:*`);
      return {
        activeKeys: keys.length,
        keyPrefix: this.keyPrefix,
        ttlSeconds: this.ttlSeconds,
      };
    } catch (error) {
      console.error("Error getting deduplication stats:", error);
      return { error: error.message };
    }
  }
}

// Create global instance
const emailDeduplicator = new EmailDeduplicator({
  ttlSeconds: 300, // 5 minutes
  keyPrefix: "airqo_email_dedup",
});

/**
 * Enhanced sendMail wrapper with deduplication
 * @param {Object} transporter - Nodemailer transporter
 * @param {Object} mailOptions - Email options
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Send result
 */
async function sendMailWithDeduplication(
  transporter,
  mailOptions,
  options = {}
) {
  const {
    skipDeduplication = false,
    logDuplicates = true,
    throwOnDuplicate = false,
  } = options;

  try {
    // Skip deduplication check if explicitly disabled
    if (!skipDeduplication) {
      const shouldSend = await emailDeduplicator.checkAndMarkEmail(mailOptions);

      if (!shouldSend) {
        const message = `Duplicate email prevented: ${mailOptions.to} - ${mailOptions.subject}`;

        if (logDuplicates) {
          console.log(message);
        }

        if (throwOnDuplicate) {
          throw new Error(message);
        }

        return {
          success: false,
          message: "Email not sent - duplicate detected",
          duplicate: true,
          data: null,
        };
      }
    }

    // Send the email
    const result = await transporter.sendMail(mailOptions);

    return {
      success: true,
      message: "Email sent successfully",
      duplicate: false,
      data: result,
    };
  } catch (error) {
    // If sending fails, remove the deduplication key to allow retry
    if (!skipDeduplication) {
      await emailDeduplicator.removeEmailKey(mailOptions);
    }

    throw error;
  }
}

module.exports = {
  EmailDeduplicator,
  emailDeduplicator,
  sendMailWithDeduplication,
};
