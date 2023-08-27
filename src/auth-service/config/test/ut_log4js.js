require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const log4js = require("@config/log4js");

// Replace "path/to" with the actual path to the required modules and files.

describe("Log4js Configuration", () => {
  describe("Appenders", () => {
    it("should have defined appenders", () => {
      expect(log4js.appenders).to.exist;
      expect(log4js.appenders.console).to.exist;
      expect(log4js.appenders.access).to.exist;
      expect(log4js.appenders.app).to.exist;
      expect(log4js.appenders.errorFile).to.exist;
      expect(log4js.appenders.errors).to.exist;
      expect(log4js.appenders.alerts).to.exist;

      // Add more assertions for each appender's properties if needed.
    });
  });

  describe("Categories", () => {
    it("should have defined categories", () => {
      expect(log4js.categories).to.exist;
      expect(log4js.categories.default).to.exist;
      expect(log4js.categories.error).to.exist;
      expect(log4js.categories.http).to.exist;

      // Add more assertions for each category's properties if needed.
    });
  });

  // You can add more test cases to cover additional scenarios or appender/category properties.
});

// Add more test cases to cover additional scenarios or appender/category properties.
