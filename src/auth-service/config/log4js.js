const { isDevelopment } = require("@utils/shared");
const constants = require("./constants");
const crypto = require("crypto");

// Deduplication cache to prevent duplicate Slack messages
const messageCache = new Map();
const DEDUP_WINDOW_MS = 10000; // 10 seconds window for deduplication
// Cache cleanup optimization
let lastCleanupTime = Date.now();
const CLEANUP_INTERVAL_MS = 60000; // Clean up every minute

// Custom Slack appender with deduplication
class DedupSlackAppender {
  constructor(config) {
    this.config = config;
    // Dynamically require the Slack appender
    this.SlackAppender = require("@log4js-node/slack");
    this.slackAppender = this.SlackAppender.configure(config);
  }

  configure(config) {
    return (loggingEvent) => {
      // Extract environment from the log message to treat PROD/STAGING separately
      const messageText = loggingEvent.data.join(" ");
      const envMatch = messageText.match(
        /(PRODUCTION|STAGING|DEVELOPMENT)\s+ENVIRONMENT/
      );
      const environment = envMatch ? envMatch[1] : "UNKNOWN";

      // Create a hash including environment, level, category, and core message content
      const messageContent = `${environment}:${loggingEvent.level.levelStr}:${loggingEvent.categoryName}:${messageText}`;
      const messageHash = crypto
        .createHash("md5")
        .update(messageContent)
        .digest("hex");

      const now = Date.now();

      // Check if we've seen this message recently
      if (messageCache.has(messageHash)) {
        const lastSent = messageCache.get(messageHash);
        if (now - lastSent < DEDUP_WINDOW_MS) {
          // Skip sending to Slack - duplicate message within time window
          console.log(
            `🔄 [AUTH-SERVICE] Deduplicating ${environment} message: ${messageText.substring(
              0,
              80
            )}...`
          );
          return;
        }
      }

      // Update cache with current timestamp
      messageCache.set(messageHash, now);

      // Clean up old entries periodically (time-based instead of size-based)
      if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
        lastCleanupTime = now;
        for (const [hash, timestamp] of messageCache.entries()) {
          if (now - timestamp > DEDUP_WINDOW_MS) {
            messageCache.delete(hash);
          }
        }
      }

      console.log(
        `📤 [AUTH-SERVICE] Sending ${environment} message to Slack: ${messageText.substring(
          0,
          80
        )}...`
      );

      // Send to Slack with error handling
      try {
        this.slackAppender(loggingEvent);
      } catch (error) {
        console.error(
          `❌ [AUTH-SERVICE] Failed to send message to Slack: ${error.message}`
        );
      }
    };
  }
}

if (isDevelopment()) {
  console.log("🚫 Log4js running in silent mode (development)");

  module.exports = {
    appenders: {
      console: { type: "console" },
    },
    categories: {
      default: { appenders: ["console"], level: "off" }, // Silent
      error: { appenders: ["console"], level: "off" }, // Silent
      http: { appenders: ["console"], level: "off" }, // Silent
    },
  };
} else {
  // Full production configuration with Slack and deduplication
  console.log(
    "📝 [AUTH-SERVICE] Log4js configured with Slack alerts and 10-second deduplication"
  );

  // Validate Slack configuration before using it
  const hasSlackConfig =
    constants.SLACK_TOKEN &&
    constants.SLACK_CHANNEL &&
    constants.SLACK_USERNAME;

  if (!hasSlackConfig) {
    console.warn(
      "⚠️  Slack configuration incomplete - some alerts may be disabled"
    );
  }

  const config = {
    appenders: {
      access: {
        type: "dateFile",
        filename: "log/access.log",
        pattern: "-yyyy-MM-dd",
        category: "http",
      },
      app: {
        type: "file",
        filename: "log/app.log",
        maxLogSize: 10485760,
        numBackups: 3,
      },
      errorFile: {
        type: "file",
        filename: "log/errors.log",
      },
      errors: {
        type: "logLevelFilter",
        level: "ERROR",
        appender: "errorFile",
      },
    },
    categories: {
      default: { appenders: [], level: "info" },
      error: { appenders: ["errors"], level: "error" },
      http: { appenders: ["access"], level: "DEBUG" },
      "api-usage-logger": { appenders: [], level: "info" },
    },
  };

  // Only add Slack appender if configuration is complete
  if (hasSlackConfig) {
    config.appenders.alerts = {
      type: DedupSlackAppender,
      token: constants.SLACK_TOKEN,
      channel_id: constants.SLACK_CHANNEL,
      username: constants.SLACK_USERNAME,
    };

    // Add alerts to relevant categories
    config.categories.default.appenders.push("alerts");
    config.categories.error.appenders.push("alerts");

    console.log("✅ Slack appender with deduplication configured successfully");
  }

  // API Usage logger should only go to stdout (no Slack)
  config.appenders.stdout = { type: "stdout" };
  config.categories["api-usage-logger"].appenders = ["stdout"];

  module.exports = config;
}

// Export the custom appender class for proper registration in app startup
module.exports.DedupSlackAppender = DedupSlackAppender;
