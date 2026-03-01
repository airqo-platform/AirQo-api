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
  console.log("📝 [AUTH-SERVICE] Log4js configured with basic Slack alerts");

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

  // Only add Slack appender if configuration is complete.
  // The slack appender and its logLevelFilter wrapper (slackErrors) are
  // both defined here so the filter never references a non-existent appender
  // — previously slackAlerts was defined in the base config before the slack
  // appender existed, risking a log4js initialisation error when hasSlackConfig
  // was false.
  if (hasSlackConfig) {
    try {
      config.appenders.slack = {
        type: "@log4js-node/slack",
        token: constants.SLACK_TOKEN,
        channel_id: constants.SLACK_CHANNEL,
        username: constants.SLACK_USERNAME,
      };

      // Wrap the Slack appender in a logLevelFilter so only ERROR and above
      // is forwarded to Slack. Previously the filter level was WARN, meaning
      // logger.warn calls also triggered Slack notifications. Alerts should
      // only fire for genuine errors that need immediate attention.
      config.appenders.slackErrors = {
        type: "logLevelFilter",
        level: "ERROR",
        appender: "slack",
      };

      // Attach the filtered Slack appender to both default and error categories
      // so all loggers regardless of their category name send errors to Slack.
      // Previously only default had the Slack appender, meaning loggers using
      // the error category would write to file but never alert Slack.
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
