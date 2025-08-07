const crypto = require("crypto");
const redisClient = require("@config/ioredis");
const constants = require("@config/constants");

// Enhanced logging setup for production
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- email-deduplication`
);

class EmailDeduplicator {
  constructor(options = {}) {
    this.ttlSeconds = options.ttlSeconds || 300; // 5 minutes default
    this.keyPrefix = options.keyPrefix || "email_dedup";
    this.enableMetrics = options.enableMetrics || false;

    // Metrics tracking for production monitoring
    this.metrics = {
      duplicatesBlocked: 0,
      emailsSent: 0,
      redisErrors: 0,
      lastResetTime: new Date(),
    };
  }

  /**
   * Get current metrics and optionally reset them
   * @param {boolean} reset - Whether to reset metrics after reading
   * @returns {Object} - Current metrics
   */
  getMetrics(reset = false) {
    const currentMetrics = { ...this.metrics };

    if (reset) {
      this.metrics = {
        duplicatesBlocked: 0,
        emailsSent: 0,
        redisErrors: 0,
        lastResetTime: new Date(),
      };
    }

    return currentMetrics;
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
      .createHash("sha256")
      .update(content)
      .digest("hex")
      .substring(0, 16); // Use first 16 characters for better collision resistance

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

      // ✅ ADD CONNECTION CHECK before Redis operation
      if (!redisClient.isOpen) {
        logger.warn(
          "Redis client not connected, bypassing deduplication check"
        );
        return true; // Allow email to be sent
      }

      // Use ioredis SET with timeout
      const setPromise = redisClient.set(key, "1", "EX", this.ttlSeconds, "NX");
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Redis SET timeout")), 2000)
      );

      const result = await Promise.race([setPromise, timeoutPromise]);
      const shouldSend = result === "OK";

      // Track metrics if enabled
      if (this.enableMetrics) {
        if (shouldSend) {
          this.metrics.emailsSent++;
        } else {
          this.metrics.duplicatesBlocked++;
          logger.info(
            `Email duplicate blocked: ${emailData.to} - ${emailData.subject}`
          );
        }
      }

      return shouldSend;
    } catch (error) {
      logger.error("Redis deduplication error, allowing email:", {
        error: error.message,
        to: emailData.to,
        subject: emailData.subject,
      });

      // Track Redis errors if metrics enabled
      if (this.enableMetrics) {
        this.metrics.redisErrors++;
      }

      // ✅ FAIL OPEN: Allow email to be sent on Redis errors
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

      if (result > 0) {
        logger.info(`Email deduplication key removed: ${key}`);
      }

      return result > 0;
    } catch (error) {
      logger.error("Error removing email key:", error);
      return false;
    }
  }

  /**
   * Get statistics about email deduplication using SCAN for production safety
   * @param {Object} options - Scan options
   * @returns {Promise<Object>} - Stats object
   */
  async getStats(options = {}) {
    try {
      const { maxKeys = 10000, scanCount = 100 } = options;

      let cursor = "0";
      let keyCount = 0;
      let scannedKeys = [];
      let iterations = 0;
      const maxIterations = Math.ceil(maxKeys / scanCount);

      do {
        // Use SCAN instead of KEYS for non-blocking iteration
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          "MATCH",
          `${this.keyPrefix}:*`,
          "COUNT",
          scanCount
        );

        cursor = newCursor;
        keyCount += keys.length;

        // Optionally collect actual keys for detailed stats
        if (options.includeKeys && scannedKeys.length < 100) {
          scannedKeys.push(...keys.slice(0, 100 - scannedKeys.length));
        }

        iterations++;

        // Safety break to prevent infinite loops in large keyspaces
        if (iterations >= maxIterations) {
          break;
        }
      } while (cursor !== "0");

      const result = {
        activeKeys: keyCount,
        keyPrefix: this.keyPrefix,
        ttlSeconds: this.ttlSeconds,
        scanIterations: iterations,
        isComplete: cursor === "0",
      };

      // Add sample keys if requested
      if (options.includeKeys && scannedKeys.length > 0) {
        result.sampleKeys = scannedKeys;
      }

      // Add performance warning if too many keys found
      if (keyCount > 1000) {
        result.warning = `High key count (${keyCount}) detected. Consider monitoring deduplication TTL settings.`;
      }

      return result;
    } catch (error) {
      logger.error("Error getting deduplication stats:", error);
      return {
        error: error.message,
        activeKeys: 0,
        keyPrefix: this.keyPrefix,
        ttlSeconds: this.ttlSeconds,
      };
    }
  }

  /**
   * Clean up expired keys using SCAN (production-safe cleanup)
   * @param {Object} options - Cleanup options
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanupExpiredKeys(options = {}) {
    try {
      const { batchSize = 100, maxBatches = 50 } = options;

      let cursor = "0";
      let deletedCount = 0;
      let checkedCount = 0;
      let batchCount = 0;

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          "MATCH",
          `${this.keyPrefix}:*`,
          "COUNT",
          batchSize
        );

        cursor = newCursor;
        checkedCount += keys.length;

        // Check TTL for each key and delete if expired or no TTL set
        if (keys.length > 0) {
          const pipeline = redisClient.pipeline();

          for (const key of keys) {
            pipeline.ttl(key);
          }

          const ttlResults = await pipeline.exec();
          const keysToDelete = [];

          ttlResults.forEach(([err, ttl], index) => {
            if (!err && (ttl === -1 || ttl === -2)) {
              // -1: key exists but no TTL, -2: key doesn't exist
              keysToDelete.push(keys[index]);
            }
          });

          if (keysToDelete.length > 0) {
            await redisClient.del(...keysToDelete);
            deletedCount += keysToDelete.length;
          }
        }

        batchCount++;
      } while (cursor !== "0" && batchCount < maxBatches);

      const result = {
        success: true,
        deletedKeys: deletedCount,
        checkedKeys: checkedCount,
        batchesProcessed: batchCount,
        isComplete: cursor === "0",
      };

      logger.info(`Cleanup completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      logger.error("Error during cleanup:", error);
      return {
        success: false,
        error: error.message,
        deletedKeys: 0,
        checkedKeys: 0,
      };
    }
  }

  /**
   * Get detailed key information using SCAN
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - Detailed key information
   */
  async getDetailedStats(options = {}) {
    try {
      const { includeKeys = false, maxKeys = 1000 } = options;

      let cursor = "0";
      let keyData = [];
      let totalKeys = 0;

      do {
        const [newCursor, keys] = await redisClient.scan(
          cursor,
          "MATCH",
          `${this.keyPrefix}:*`,
          "COUNT",
          100
        );

        cursor = newCursor;
        totalKeys += keys.length;

        if (includeKeys && keys.length > 0 && keyData.length < maxKeys) {
          // Get TTL for each key using pipeline for efficiency
          const pipeline = redisClient.pipeline();
          keys.forEach((key) => pipeline.ttl(key));

          const ttlResults = await pipeline.exec();

          keys.forEach((key, index) => {
            if (keyData.length < maxKeys) {
              const [err, ttl] = ttlResults[index];
              keyData.push({
                key,
                ttl: err ? -1 : ttl,
                expiresAt: ttl > 0 ? new Date(Date.now() + ttl * 1000) : null,
              });
            }
          });
        }
      } while (cursor !== "0" && keyData.length < maxKeys);

      return {
        totalKeys,
        keyPrefix: this.keyPrefix,
        ttlSeconds: this.ttlSeconds,
        sampleSize: keyData.length,
        keys: includeKeys ? keyData : [],
        isComplete: cursor === "0",
      };
    } catch (error) {
      logger.error("Error getting detailed stats:", error);
      return {
        error: error.message,
        totalKeys: 0,
        keyPrefix: this.keyPrefix,
        keys: [],
      };
    }
  }
}

// Create global instance with enhanced configuration
const emailDeduplicator = new EmailDeduplicator({
  ttlSeconds: 300, // 5 minutes
  keyPrefix: "airqo_email_dedup",
  enableMetrics: true, // Enable production metrics tracking
});

/**
 * Enhanced sendMail wrapper with deduplication and improved logging
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
      try {
        // ✅ ADD TIMEOUT for Redis operations
        const shouldSendPromise =
          emailDeduplicator.checkAndMarkEmail(mailOptions);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Redis timeout")), 3000)
        );

        const shouldSend = await Promise.race([
          shouldSendPromise,
          timeoutPromise,
        ]);

        if (!shouldSend) {
          const message = `Duplicate email prevented: ${mailOptions.to} - ${mailOptions.subject}`;

          if (logDuplicates) {
            logger.info(message);
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
      } catch (redisError) {
        // ✅ REDIS FAILURE HANDLING: Log error but continue with email sending
        logger.warn(
          `Redis deduplication check failed, sending email anyway: ${redisError.message}`,
          {
            email: mailOptions.to,
            subject: mailOptions.subject,
            redisError: redisError.message,
          }
        );

        // Continue to send email - better to have duplicate than no email
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
    // If sending fails, try to remove the deduplication key (if Redis is working)
    if (!skipDeduplication) {
      try {
        await emailDeduplicator.removeEmailKey(mailOptions);
        logger.warn(
          `Email send failed, removed deduplication key for retry: ${mailOptions.to}`
        );
      } catch (removeError) {
        logger.warn(
          `Failed to remove deduplication key after send failure: ${removeError.message}`
        );
      }
    }

    // ✅ ENHANCED ERROR LOGGING for Gmail issues
    logger.error("Email send failed", {
      to: mailOptions.to,
      subject: mailOptions.subject,
      error: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode,
      // Gmail-specific error details
      isGmailRecipient: mailOptions.to.includes("@gmail.com"),
      stack: error.stack?.substring(0, 500),
    });

    throw error;
  }
}

module.exports = {
  EmailDeduplicator,
  emailDeduplicator,
  sendMailWithDeduplication,
};
