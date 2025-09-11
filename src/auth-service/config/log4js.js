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
    },
  };
} else {
  // SAFE production configuration - back to basic Slack (NO custom appenders)
  console.log("📝 [AUTH-SERVICE] Log4js configured with basic Slack alerts");

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
      // Add a log level filter for Slack alerts
      slackAlerts: {
        type: "logLevelFilter",
        appender: "slack",
        level: "WARN", // Only send WARN, ERROR, FATAL to Slack
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
    try {
      config.appenders.slack = {
        type: "@log4js-node/slack",
        token: constants.SLACK_TOKEN,
        channel_id: constants.SLACK_CHANNEL,
        username: constants.SLACK_USERNAME,
      };

      // Add the filtered alerts to the default category. It will catch all levels.
      config.categories.default.appenders.push("slackAlerts");

      console.log("✅ Slack appender configured successfully");
    } catch (error) {
      console.error("❌ Failed to configure Slack appender:", error.message);
      console.log("📝 Continuing without Slack notifications");
    }
  }

  // API Usage logger should only go to stdout (no Slack)
  config.appenders.stdout = { type: "stdout" };
  config.categories["api-usage-logger"].appenders = ["stdout"];

  module.exports = config;
}
