const crypto = require("crypto");

// Simple deduplication utility that works with any logger
class SlackDeduplicator {
  constructor(windowMs = 10000) {
    this.messageCache = new Map();
    this.dedupWindowMs = windowMs;
    this.lastCleanupTime = Date.now();
    this.cleanupIntervalMs = 60000; // Clean up every minute
  }

  // Check if message should be sent or is a duplicate
  shouldSendMessage(messageText, level = "INFO", category = "default") {
    try {
      // Extract environment from message
      const envMatch = messageText.match(
        /(PRODUCTION|STAGING|DEVELOPMENT)\s+ENVIRONMENT/
      );
      const environment = envMatch ? envMatch[1] : "UNKNOWN";

      // Create unique hash for this message
      const messageContent = `${environment}:${level}:${category}:${messageText}`;
      const messageHash = crypto
        .createHash("md5")
        .update(messageContent)
        .digest("hex");

      const now = Date.now();

      // Check if we've seen this message recently
      if (this.messageCache.has(messageHash)) {
        const lastSent = this.messageCache.get(messageHash);
        if (now - lastSent < this.dedupWindowMs) {
          console.log(
            `🔄 [DEDUP] Skipping duplicate ${environment} message: ${messageText.substring(
              0,
              80
            )}...`
          );
          return false; // Don't send - it's a duplicate
        }
      }

      // Update cache with current timestamp
      this.messageCache.set(messageHash, now);

      // Cleanup old entries periodically
      if (now - this.lastCleanupTime > this.cleanupIntervalMs) {
        this.lastCleanupTime = now;
        for (const [hash, timestamp] of this.messageCache.entries()) {
          if (now - timestamp > this.dedupWindowMs) {
            this.messageCache.delete(hash);
          }
        }
      }

      console.log(
        `📤 [DEDUP] Allowing ${environment} message to Slack: ${messageText.substring(
          0,
          80
        )}...`
      );
      return true; // Send the message
    } catch (error) {
      console.error(
        `❌ [DEDUP] Error in deduplication logic: ${error.message}`
      );
      return true; // When in doubt, send the message
    }
  }

  // Wrapper function for logger calls
  wrapLogger(logger) {
    const originalError = logger.error.bind(logger);
    const originalWarn = logger.warn.bind(logger);
    const originalInfo = logger.info.bind(logger);

    return {
      ...logger,
      error: (...args) => {
        const messageText = args.join(" ");
        if (this.shouldSendMessage(messageText, "ERROR", "error")) {
          originalError(...args);
        }
      },
      warn: (...args) => {
        const messageText = args.join(" ");
        if (this.shouldSendMessage(messageText, "WARN", "default")) {
          originalWarn(...args);
        }
      },
      info: (...args) => {
        const messageText = args.join(" ");
        if (this.shouldSendMessage(messageText, "INFO", "default")) {
          originalInfo(...args);
        }
      },
    };
  }
}

// Create a global instance
const slackDeduplicator = new SlackDeduplicator();

module.exports = {
  SlackDeduplicator,
  deduplicator: slackDeduplicator,
};
