require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

// Stub the required modules
const constantsStub = {
  SLACK_TOKEN: "slack-token",
  SLACK_CHANNEL: "slack-channel",
  SLACK_USERNAME: "slack-username",
};

const log4jsModule = proxyquire("@config/log4js", {
  "@config/constants": constantsStub,
});

describe("Log4js Configuration", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should have the correct appenders", () => {
    const expectedAppenders = {
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
        token: constantsStub.SLACK_TOKEN,
        channel_id: constantsStub.SLACK_CHANNEL,
        username: constantsStub.SLACK_USERNAME,
      },
    };

    expect(log4jsModule.appenders).to.deep.equal(expectedAppenders);
  });

  it("should have the correct categories", () => {
    const expectedCategories = {
      default: { appenders: ["alerts"], level: "info" },
      error: { appenders: ["alerts", "errors"], level: "error" },
      http: { appenders: ["access"], level: "DEBUG" },
    };

    expect(log4jsModule.categories).to.deep.equal(expectedCategories);
  });

  // Add more tests for other properties if necessary
});
