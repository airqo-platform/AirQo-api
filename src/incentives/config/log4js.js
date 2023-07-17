const { logElement } = require("@utils/log");
const constants = require("./constants");
const log4js = {
  appenders: {
    console: { type: "console" },
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

module.exports = log4js;
