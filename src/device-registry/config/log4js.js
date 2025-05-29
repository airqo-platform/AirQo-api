// SIMPLEST FIX: Just replace your config/log4js.js file with this:

const { isDevelopment } = require("@utils/shared");
const constants = require("./constants");

if (isDevelopment()) {
  // Don't even try to configure Slack in development
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
  // Full production configuration with Slack
  console.log("📝 Log4js configured with Slack alerts");

  module.exports = {
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
      alerts: {
        type: "@log4js-node/slack",
        token: constants.SLACK_TOKEN,
        channel_id: constants.SLACK_CHANNEL,
        username: constants.SLACK_USERNAME,
      },
    },
    categories: {
      default: { appenders: ["alerts"], level: "info" },
      error: { appenders: ["alerts", "errors"], level: "error" },
      http: { appenders: ["access"], level: "DEBUG" },
    },
  };
}
