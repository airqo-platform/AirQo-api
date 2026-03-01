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
  console.log("📝 [DEVICE-REGISTRY] Log4js configured with basic Slack alerts");

  const hasSlackConfig =
    constants.SLACK_TOKEN &&
    constants.SLACK_CHANNEL &&
    constants.SLACK_USERNAME;

  if (!hasSlackConfig) {
    console.warn(
      "⚠️  Slack configuration incomplete - some alerts may be disabled",
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

  if (hasSlackConfig) {
    try {
      // Renamed from "alerts" to "slack" to match auth-service naming convention.
      config.appenders.slack = {
        type: "@log4js-node/slack",
        token: constants.SLACK_TOKEN,
        channel_id: constants.SLACK_CHANNEL,
        username: constants.SLACK_USERNAME,
      };

      // logLevelFilter wrapping "slack" (updated from "alerts") so only
      // ERROR and above is forwarded to Slack.
      config.appenders.slackErrors = {
        type: "logLevelFilter",
        level: "ERROR",
        appender: "slack",
      };

      config.categories.default.appenders.push("slackErrors");
      config.categories.error.appenders.push("slackErrors");

      console.log(
        "✅ Slack appender configured successfully (ERROR and above only)",
      );
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
