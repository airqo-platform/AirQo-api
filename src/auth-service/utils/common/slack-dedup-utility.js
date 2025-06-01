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

  // Wrapper function for logger calls with dynamic API preservation via Proxy
  wrapLogger(logger) {
    // Methods that should have deduplication applied (typically send Slack alerts)
    const deduplicatedMethods = new Set(["error", "warn", "info"]);

    return new Proxy(logger, {
      get: (target, property, receiver) => {
        const originalValue = Reflect.get(target, property, receiver);

        // If it's a method we want to deduplicate and it's a function
        if (
          deduplicatedMethods.has(property) &&
          typeof originalValue === "function"
        ) {
          return (...args) => {
            // Enhanced message text construction to preserve object structure
            const messageText = args
              .map((arg) => {
                if (typeof arg === "string") {
                  return arg;
                } else if (
                  typeof arg === "number" ||
                  typeof arg === "boolean"
                ) {
                  return String(arg);
                } else if (arg === null) {
                  return "null";
                } else if (arg === undefined) {
                  return "undefined";
                } else {
                  // For objects, arrays, functions, etc. - preserve structure
                  try {
                    return JSON.stringify(arg);
                  } catch (error) {
                    // Fallback for circular references or non-serializable objects
                    return String(arg);
                  }
                }
              })
              .join(" ");
            const levelMap = {
              error: "ERROR",
              warn: "WARN",
              info: "INFO",
            };
            const categoryMap = {
              error: "error",
              warn: "default",
              info: "default",
            };

            if (
              this.shouldSendMessage(
                messageText,
                levelMap[property],
                categoryMap[property]
              )
            ) {
              return originalValue.apply(target, args);
            }
            // If message is deduplicated, don't call the original method
          };
        }

        // For all other properties/methods, return as-is
        // This includes: debug, trace, fatal, mark, level, category, context,
        // addContext, removeContext, clearContext, and any future additions
        return originalValue;
      },

      set: (target, property, value, receiver) => {
        // Allow setting properties (like level, context, etc.)
        return Reflect.set(target, property, value, receiver);
      },

      has: (target, property) => {
        // Ensure 'in' operator works correctly
        return Reflect.has(target, property);
      },

      ownKeys: (target) => {
        // Ensure Object.keys() and similar work correctly
        return Reflect.ownKeys(target);
      },

      getOwnPropertyDescriptor: (target, property) => {
        // Ensure property descriptors are preserved
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
  }
}

// Create a global instance
const slackDeduplicator = new SlackDeduplicator();

module.exports = {
  SlackDeduplicator,
  deduplicator: slackDeduplicator,
};
