const { isDevelopment } = require("@utils/shared");
const constants = require("./constants");

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
      alerts: { appenders: ["console"], level: "off" }, // Silent
      critical: { appenders: ["console"], level: "off" }, // Silent
    },
  };
} else {
  console.log(
    "📝 [DEVICE-REGISTRY] Log4js configured with enhanced Slack alerts and deduplication"
  );

  // Validate Slack configuration
  const hasSlackConfig =
    constants.SLACK_TOKEN &&
    constants.SLACK_CHANNEL &&
    constants.SLACK_USERNAME;

  if (!hasSlackConfig) {
    console.warn(
      "⚠️  Slack configuration incomplete - alerts will be disabled"
    );
  }

  // Core appenders for file logging
  const config = {
    appenders: {
      // Enhanced file appenders with date rotation and compression
      access: {
        type: "dateFile",
        filename: "log/access.log",
        pattern: "-yyyy-MM-dd",
        category: "http",
        compress: true,
        keepFileExt: true,
        maxLogSize: 10485760,
        numBackups: 7,
      },
      app: {
        type: "dateFile",
        filename: "log/app.log",
        pattern: "-yyyy-MM-dd",
        compress: true,
        keepFileExt: true,
        maxLogSize: 10485760,
        numBackups: 7,
      },
      errorFile: {
        type: "dateFile",
        filename: "log/errors.log",
        pattern: "-yyyy-MM-dd",
        compress: true,
        keepFileExt: true,
        maxLogSize: 10485760,
        numBackups: 14, // Keep error logs longer
      },
      stdout: {
        type: "stdout",
        layout: {
          type: "pattern",
          pattern: "[%d{ISO8601}] [%p] %c - %m",
        },
      },
      // Filtered error appender
      errors: {
        type: "logLevelFilter",
        level: "ERROR",
        appender: "errorFile",
      },
    },
    categories: {
      // Default category - app logs + stdout (NO Slack to avoid spam)
      default: {
        appenders: ["app", "stdout"],
        level: "info",
      },
      // Error category - errors + stdout (NO Slack here either)
      error: {
        appenders: ["errors", "stdout"],
        level: "error",
      },
      // HTTP category - access logs only
      http: {
        appenders: ["access"],
        level: "DEBUG",
      },
      // API usage - stdout only (no files, no Slack)
      "api-usage-logger": {
        appenders: ["stdout"],
        level: "info",
      },
      // Dedicated alerts category - ONLY for Slack notifications
      alerts: {
        appenders: ["stdout"],
        level: "warn",
      },
      // Critical alerts - for high-priority notifications
      critical: {
        appenders: ["errorFile", "stdout"],
        level: "error",
      },
    },
  };

  // Add Slack appender ONLY to dedicated categories
  if (hasSlackConfig) {
    try {
      // Enhanced Slack appender configuration
      config.appenders.slackAlerts = {
        type: "@log4js-node/slack",
        token: constants.SLACK_TOKEN,
        channel_id: constants.SLACK_CHANNEL,
        username: `${constants.SLACK_USERNAME}-${constants.ENVIRONMENT}`,
        layout: {
          type: "pattern",
          pattern: "[%d{ISO8601}] [%p] %m",
        },
      };

      // Add Slack ONLY to specific alert categories
      config.categories.alerts.appenders.push("slackAlerts");
      config.categories.critical.appenders.push("slackAlerts");

      console.log(
        "✅ Slack appender configured for dedicated alert categories"
      );
    } catch (error) {
      console.error("❌ Failed to configure Slack appender:", error.message);
      console.log("📝 Continuing without Slack notifications");
    }
  }

  module.exports = config;
}
