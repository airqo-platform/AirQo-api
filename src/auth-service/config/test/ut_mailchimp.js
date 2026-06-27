require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const mailchimp = require("@config/mailchimp");

describe("Mailchimp Configuration", () => {
  it("should export a configured mailchimp client", () => {
    expect(mailchimp).to.exist;
    expect(mailchimp.setConfig).to.be.a("function");
  });

  it("should expose mailchimp API surface (lists, ping)", () => {
    expect(mailchimp.lists).to.exist;
    expect(mailchimp.ping).to.exist;
  });
});
