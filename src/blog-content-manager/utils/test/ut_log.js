require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { logText, logElement, logObject, logError } = require("@utils/log");

describe("logger", () => {
  describe("logText", () => {
    it("should log the message in non-production environments", () => {
      const consoleSpy = sinon.spy(console, "log");
      const message = "This is a log message.";

      logText(message);

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.equal(message);

      consoleSpy.restore();
    });

    it("should return the correct log deactivation message in production environment", () => {
      const message = "This is a log message.";
      process.env.NODE_ENV = "production";

      const result = logText(message);

      expect(result).to.equal("log deactivated in prod and stage");
      process.env.NODE_ENV = "test"; // Reset NODE_ENV to 'test'
    });
  });

  describe("logElement", () => {
    it("should log the message and body in non-production environments", () => {
      const consoleSpy = sinon.spy(console, "log");
      const message = "Log element";
      const body = { key: "value" };

      logElement(message, body);

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.equal(
        `${message}: ${JSON.stringify(body)}`
      );

      consoleSpy.restore();
    });

    it("should return the correct log deactivation message in production environment", () => {
      const message = "Log element";
      const body = { key: "value" };
      process.env.NODE_ENV = "production";

      const result = logElement(message, body);

      expect(result).to.equal("log deactivated in prod and stage");
      process.env.NODE_ENV = "test"; // Reset NODE_ENV to 'test'
    });
  });

  describe("logObject", () => {
    it("should log the message and object in non-production environments", () => {
      const consoleSpy = sinon.spy(console, "log");
      const message = "Log object";
      const object = { key1: "value1", key2: "value2" };

      logObject(message, object);

      expect(consoleSpy.calledOnce).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.equal(`${message}: `);
      expect(consoleSpy.firstCall.args[1]).to.deep.equal(object);

      consoleSpy.restore();
    });

    it("should return the correct log deactivation message in production environment", () => {
      const message = "Log object";
      const object = { key1: "value1", key2: "value2" };
      process.env.NODE_ENV = "production";

      const result = logObject(message, object);

      expect(result).to.equal("log deactivated in prod and stage");
      process.env.NODE_ENV = "test"; // Reset NODE_ENV to 'test'
    });
  });

  describe("logError", () => {
    it("should log the error in non-production environments", () => {
      const consoleErrorSpy = sinon.spy(console, "error");
      const error = new Error("An error occurred");

      logError(error);

      expect(consoleErrorSpy.calledOnce).to.be.true;
      expect(consoleErrorSpy.firstCall.args[0]).to.equal(
        "an unhandled promise rejection: "
      );
      expect(consoleErrorSpy.firstCall.args[1]).to.equal(error);

      consoleErrorSpy.restore();
    });

    it("should return the correct log deactivation message in production environment", () => {
      const error = new Error("An error occurred");
      process.env.NODE_ENV = "production";

      const result = logError(error);

      expect(result).to.equal("log deactivated in prod and stage");
      process.env.NODE_ENV = "test"; // Reset NODE_ENV to 'test'
    });
  });
});
