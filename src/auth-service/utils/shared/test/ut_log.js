require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const constants = require("@config/constants");
const { logText, logElement, logObject, logError } = require("@utils/shared/log");

describe("logger", () => {
  let originalEnvironment;

  beforeEach(() => {
    originalEnvironment = constants.ENVIRONMENT;
  });

  afterEach(() => {
    constants.ENVIRONMENT = originalEnvironment;
    sinon.restore();
  });

  describe("logText", () => {
    it("should log the message and return undefined in non-production environments", () => {
      constants.ENVIRONMENT = "DEVELOPMENT ENVIRONMENT";
      const consoleSpy = sinon.spy(console, "log");
      const message = "This is a log message.";

      const result = logText(message);

      expect(consoleSpy.calledOnceWithExactly(message)).to.be.true;
      expect(result).to.be.undefined;
    });

    it("should not log and should return undefined in the production environment", () => {
      constants.ENVIRONMENT = "PRODUCTION ENVIRONMENT";
      const consoleSpy = sinon.spy(console, "log");
      const message = "This is a log message.";

      const result = logText(message);

      expect(consoleSpy.called).to.be.false;
      expect(result).to.be.undefined;
    });
  });

  describe("logElement", () => {
    it("should log 'message: body' (string-concatenated) and return undefined in non-production environments", () => {
      constants.ENVIRONMENT = "DEVELOPMENT ENVIRONMENT";
      const consoleSpy = sinon.spy(console, "log");
      const message = "Log element";
      const body = { key: "value" };

      const result = logElement(message, body);

      // logElement does `message + ": " + body`, a plain string concatenation,
      // which stringifies an object via its default toString() -> "[object Object]".
      expect(
        consoleSpy.calledOnceWithExactly(`${message}: ${body}`)
      ).to.be.true;
      expect(consoleSpy.firstCall.args[0]).to.equal("Log element: [object Object]");
      expect(result).to.be.undefined;
    });

    it("should not log and should return undefined in the production environment", () => {
      constants.ENVIRONMENT = "PRODUCTION ENVIRONMENT";
      const consoleSpy = sinon.spy(console, "log");

      const result = logElement("Log element", { key: "value" });

      expect(consoleSpy.called).to.be.false;
      expect(result).to.be.undefined;
    });
  });

  describe("logObject", () => {
    it("should log 'message: ' followed by console.dir(object) and return undefined in non-production environments", () => {
      constants.ENVIRONMENT = "DEVELOPMENT ENVIRONMENT";
      const consoleLogSpy = sinon.spy(console, "log");
      const consoleDirSpy = sinon.spy(console, "dir");
      const message = "Log object";
      const object = { key1: "value1", key2: "value2" };

      const result = logObject(message, object);

      expect(consoleLogSpy.calledOnceWithExactly(`${message}: `)).to.be.true;
      expect(consoleDirSpy.calledOnceWithExactly(object)).to.be.true;
      expect(result).to.be.undefined;
    });

    it("should log only the message when called with a single argument", () => {
      constants.ENVIRONMENT = "DEVELOPMENT ENVIRONMENT";
      const consoleLogSpy = sinon.spy(console, "log");
      const message = "Just a message";

      const result = logObject(message);

      expect(consoleLogSpy.calledOnceWithExactly(message)).to.be.true;
      expect(result).to.be.undefined;
    });

    it("should log only the message when the object argument is null/undefined", () => {
      constants.ENVIRONMENT = "DEVELOPMENT ENVIRONMENT";
      const consoleLogSpy = sinon.spy(console, "log");
      const message = "Message with null object";

      const result = logObject(message, null);

      expect(consoleLogSpy.calledOnceWithExactly(message)).to.be.true;
      expect(result).to.be.undefined;
    });

    it("should not log and should return undefined in the production environment", () => {
      constants.ENVIRONMENT = "PRODUCTION ENVIRONMENT";
      const consoleLogSpy = sinon.spy(console, "log");
      const consoleDirSpy = sinon.spy(console, "dir");

      const result = logObject("Log object", { key1: "value1" });

      expect(consoleLogSpy.called).to.be.false;
      expect(consoleDirSpy.called).to.be.false;
      expect(result).to.be.undefined;
    });
  });

  describe("logError", () => {
    it("should log the prefix message and the error and return undefined in non-production environments", () => {
      constants.ENVIRONMENT = "DEVELOPMENT ENVIRONMENT";
      const consoleLogSpy = sinon.spy(console, "log");
      const consoleErrorSpy = sinon.spy(console, "error");
      const error = new Error("An error occurred");

      const result = logError(error);

      expect(
        consoleLogSpy.calledOnceWithExactly("an unhandled promise rejection: ")
      ).to.be.true;
      expect(consoleErrorSpy.calledOnceWithExactly(error)).to.be.true;
      expect(result).to.be.undefined;
    });

    it("should not log and should return undefined in the production environment", () => {
      constants.ENVIRONMENT = "PRODUCTION ENVIRONMENT";
      const consoleLogSpy = sinon.spy(console, "log");
      const consoleErrorSpy = sinon.spy(console, "error");

      const result = logError(new Error("An error occurred"));

      expect(consoleLogSpy.called).to.be.false;
      expect(consoleErrorSpy.called).to.be.false;
      expect(result).to.be.undefined;
    });
  });
});
