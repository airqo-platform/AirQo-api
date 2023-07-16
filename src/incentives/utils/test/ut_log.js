const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;

const { logText, logElement, logObject } = require("./loggingUtils");

describe("loggingUtils", () => {
  describe("logText", () => {
    it("should log the message in development environment", () => {
      const consoleLogStub = sinon.stub(console, "log");

      process.env.NODE_ENV = "development";

      logText("Test message");

      expect(consoleLogStub.calledOnce).to.be.true;
      expect(consoleLogStub.firstCall.args[0]).to.equal("Test message");

      consoleLogStub.restore();
    });

    it("should not log the message in non-development environment", () => {
      const consoleLogStub = sinon.stub(console, "log");

      process.env.NODE_ENV = "production";

      logText("Test message");

      expect(consoleLogStub.called).to.be.false;

      consoleLogStub.restore();
    });
  });

  describe("logElement", () => {
    it("should log the message and body in development environment", () => {
      const consoleLogStub = sinon.stub(console, "log");

      process.env.NODE_ENV = "development";

      logElement("Test message", "Test body");

      expect(consoleLogStub.calledOnce).to.be.true;
      expect(consoleLogStub.firstCall.args[0]).to.equal(
        "Test message: Test body"
      );

      consoleLogStub.restore();
    });

    it("should not log the message and body in non-development environment", () => {
      const consoleLogStub = sinon.stub(console, "log");

      process.env.NODE_ENV = "production";

      logElement("Test message", "Test body");

      expect(consoleLogStub.called).to.be.false;

      consoleLogStub.restore();
    });
  });

  describe("logObject", () => {
    it("should log the message and object in development environment", () => {
      const consoleLogStub = sinon.stub(console, "log");
      const consoleDirStub = sinon.stub(console, "dir");

      process.env.NODE_ENV = "development";

      const testObject = { key: "value" };

      logObject("Test message", testObject);

      expect(consoleLogStub.calledOnce).to.be.true;
      expect(consoleLogStub.firstCall.args[0]).to.equal("Test message: ");

      expect(consoleDirStub.calledOnce).to.be.true;
      expect(consoleDirStub.firstCall.args[0]).to.deep.equal(testObject);

      consoleLogStub.restore();
      consoleDirStub.restore();
    });

    it("should not log the message and object in non-development environment", () => {
      const consoleLogStub = sinon.stub(console, "log");
      const consoleDirStub = sinon.stub(console, "dir");

      process.env.NODE_ENV = "production";

      const testObject = { key: "value" };

      logObject("Test message", testObject);

      expect(consoleLogStub.called).to.be.false;
      expect(consoleDirStub.called).to.be.false;

      consoleLogStub.restore();
      consoleDirStub.restore();
    });
  });

  // Add more test cases if needed
});
