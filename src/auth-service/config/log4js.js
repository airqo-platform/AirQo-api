const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const constants = require("./constants");
const log4js = {
  appenders: {
    console: { type: "console" },
    out: { type: "stdout" }, // Log to standard output (essential for Cloud Run/Functions)
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
    default: { appenders: ["alerts", "out"], level: "info" },
    error: { appenders: ["alerts", "errors"], level: "error" },
    http: { appenders: ["access"], level: "DEBUG" },
    "api-usage-logger": { appenders: ["out"], level: "info" }, // API Usage logs *only* to stdout, not to slack!
  },
};

module.exports = log4js;
