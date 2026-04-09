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
  console.log(
    "📝 [AUTH-SERVICE] Log4js configured (Slack alerts for ERROR only when configured)",
  );

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
      // "app" is always present so INFO and WARN logs are written to file
      // regardless of whether the Slack appender is configured. Previously
      // default only received slackErrors (filtered at ERROR), meaning all
      // INFO and WARN logs were silently discarded.
      default: { appenders: ["app"], level: "info" },
      error: { appenders: ["errors"], level: "error" },
      http: { appenders: ["access"], level: "DEBUG" },
      "api-usage-logger": { appenders: [], level: "info" },

      // Dedicated category for operational jobs that need WARN visibility
      // in Slack. Unlike the default category which is restricted to ERROR
      // only for Slack, ops-alerts forwards WARN and above to Slack so
      // actionable operational messages reach the team without opening up
      // the entire codebase to warn-level Slack noise.
      // Usage: const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- <job-name> -- ops-alerts`);
      "ops-alerts": { appenders: ["app"], level: "info" },
    },
  };

  if (hasSlackConfig) {
    try {
      config.appenders.slack = {
        type: "@log4js-node/slack",
        token: constants.SLACK_TOKEN,
        channel_id: constants.SLACK_CHANNEL,
        username: constants.SLACK_USERNAME,
      };

      // slackErrors — ERROR and above only. Used by default and error categories.
      // Keeps routine INFO/WARN logs out of Slack for the general codebase.
      config.appenders.slackErrors = {
        type: "logLevelFilter",
        level: "ERROR",
        appender: "slack",
      };

      // slackWarn — WARN and above. Used only by the ops-alerts category so
      // specific operational jobs can send WARNING and higher to Slack without
      // opening up the entire codebase to warn-level Slack noise.
      config.appenders.slackWarn = {
        type: "logLevelFilter",
        level: "WARN",
        appender: "slack",
      };

      config.categories.default.appenders.push("slackErrors");
      config.categories.error.appenders.push("slackErrors");
      config.categories["ops-alerts"].appenders.push("slackWarn");

      console.log(
        "✅ Slack appender configured successfully (ERROR and above only, WARN and above for ops-alerts)",
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
