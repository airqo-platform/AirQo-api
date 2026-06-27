require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru().noPreserveCache();
const { expect } = chai;

describe("Mailchimp Configuration", () => {
  let setConfigStub;
  let mailchimp;

  beforeEach(() => {
    setConfigStub = sinon.stub();
    // Stub the SDK before @config/mailchimp is required so the config call is captured
    mailchimp = proxyquire("@config/mailchimp", {
      "@mailchimp/mailchimp_marketing": {
        setConfig: setConfigStub,
        lists: {},
        ping: {},
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call setConfig with the expected apiKey and server values", () => {
    const constants = require("@config/constants");
    expect(setConfigStub.calledOnce).to.be.true;
    expect(setConfigStub.firstCall.args[0]).to.deep.equal({
      apiKey: constants.MAILCHIMP_API_KEY,
      server: constants.MAILCHIMP_SERVER_PREFIX,
    });
  });

  it("should expose mailchimp API surface (lists, ping)", () => {
    expect(mailchimp).to.exist;
    expect(mailchimp.lists).to.exist;
    expect(mailchimp.ping).to.exist;
  });
});
