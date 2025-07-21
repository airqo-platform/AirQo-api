require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const log4js = require("@config/log4js");

describe("log4js", () => {
  it("should have the correct appenders", () => {
    const appenders = log4js.appenders;
    expect(appenders).to.have.property("console");
    expect(appenders).to.have.property("access");
    expect(appenders).to.have.property("app");
    expect(appenders).to.have.property("errorFile");
    expect(appenders).to.have.property("errors");
    expect(appenders).to.have.property("alerts");
  });

  it("should have the correct categories", () => {
    const categories = log4js.categories;
    expect(categories).to.have.property("default");
    expect(categories).to.have.property("error");
    expect(categories).to.have.property("http");
  });

  it("should have the correct configuration values", () => {
    const alertsAppender = log4js.appenders.alerts;
    const constants = require("./constants");
    expect(alertsAppender.type).to.equal("@log4js-node/slack");
    expect(alertsAppender.token).to.equal(constants.SLACK_TOKEN);
    expect(alertsAppender.channel_id).to.equal(constants.SLACK_CHANNEL);
    expect(alertsAppender.username).to.equal(constants.SLACK_USERNAME);
  });
});
