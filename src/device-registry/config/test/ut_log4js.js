require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");

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

  it("should have the console appender configured", () => {
    expect(log4jsModule.appenders).to.exist;
    expect(log4jsModule.appenders.console).to.exist;
    expect(log4jsModule.appenders.console.type).to.equal("console");
  });

  it("should have valid categories with at least a default", () => {
    expect(log4jsModule.categories).to.exist;
    expect(log4jsModule.categories.default).to.exist;
    expect(log4jsModule.categories.default.appenders).to.be.an("array").that.includes("console");
  });
});
