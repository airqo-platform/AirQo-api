require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const mailchimp = require("@config/mailchimp");

// Replace "path/to" with the actual path to the required modules and files.

describe("Mailchimp Configuration", () => {
  describe("Mailchimp API Key", () => {
    it("should have a valid API key", () => {
      expect(mailchimp.getConfig().apiKey).to.equal(
        constants.MAILCHIMP_API_KEY
      );
    });
  });

  describe("Mailchimp Server", () => {
    it("should have a valid server prefix", () => {
      expect(mailchimp.getConfig().server).to.equal(
        constants.MAILCHIMP_SERVER_PREFIX
      );
    });
  });

  // Add more test cases to cover additional scenarios or configuration properties.
});

// Add more test cases to cover additional scenarios or configuration properties.
