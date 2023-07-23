require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const { logText, logElement, logObject, logError } = require("@utils/log"); // Update the path if needed

describe("logUtils", () => {
  describe("logText", () => {
    it("should log the message when NODE_ENV is not 'production'", () => {
      const consoleLogStub = sinon.stub(console, "log");
      const message = "Hello, world!";
      const result = logText(message);

      expect(result).to.equal("log deactivated in prod and stage");
      expect(consoleLogStub.calledOnceWithExactly(message)).to.be.true;

      consoleLogStub.restore();
    });

    it("should return the default message when NODE_ENV is 'production'", () => {
      const consoleLogStub = sinon.stub(console, "log");
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const message = "Hello, world!";
      const result = logText(message);

      expect(result).to.equal("log deactivated in prod and stage");
      expect(consoleLogStub.notCalled).to.be.true;

      process.env.NODE_ENV = originalNodeEnv;
      consoleLogStub.restore();
    });
  });
  describe("logElement", () => {
    it("should log the message and body when NODE_ENV is not 'production'", () => {
      const consoleLogStub = sinon.stub(console, "log");
      const message = "Element:";
      const body = { key: "value" };
      const result = logElement(message, body);

      expect(result).to.equal("log deactivated in prod and stage");
      expect(
        consoleLogStub.calledOnceWithExactly(
          `${message} ${JSON.stringify(body)}`
        )
      ).to.be.true;

      consoleLogStub.restore();
    });

    it("should return the default message when NODE_ENV is 'production'", () => {
      const consoleLogStub = sinon.stub(console, "log");
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const message = "Element:";
      const body = { key: "value" };
      const result = logElement(message, body);

      expect(result).to.equal("log deactivated in prod and stage");
      expect(consoleLogStub.notCalled).to.be.true;

      process.env.NODE_ENV = originalNodeEnv;
      consoleLogStub.restore();
    });
  });
  describe("logObject", () => {
    it("should log the message and object when NODE_ENV is not 'production'", () => {
      const consoleDirStub = sinon.stub(console, "dir");
      const message = "Object:";
      const object = { key: "value" };
      const result = logObject(message, object);

      expect(result).to.equal("log deactivated in prod and stage");
      expect(consoleDirStub.calledOnceWithExactly(object)).to.be.true;

      consoleDirStub.restore();
    });

    it("should return the default message when NODE_ENV is 'production'", () => {
      const consoleDirStub = sinon.stub(console, "dir");
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const message = "Object:";
      const object = { key: "value" };
      const result = logObject(message, object);

      expect(result).to.equal("log deactivated in prod and stage");
      expect(consoleDirStub.notCalled).to.be.true;

      process.env.NODE_ENV = originalNodeEnv;
      consoleDirStub.restore();
    });
  });
  describe("logError", () => {
    it("should log the error message when NODE_ENV is not 'production'", () => {
      const consoleLogStub = sinon.stub(console, "log");
      const consoleErrorStub = sinon.stub(console, "error");
      const errorMessage = "Something went wrong!";
      const error = new Error(errorMessage);
      const result = logError(error);

      expect(result).to.equal("log deactivated in prod and stage");
      expect(
        consoleLogStub.calledOnceWithExactly("an unhandled promise rejection:")
      ).to.be.true;
      expect(consoleErrorStub.calledOnceWithExactly(error)).to.be.true;

      consoleLogStub.restore();
      consoleErrorStub.restore();
    });

    it("should return the default message when NODE_ENV is 'production'", () => {
      const consoleLogStub = sinon.stub(console, "log");
      const consoleErrorStub = sinon.stub(console, "error");
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const errorMessage = "Something went wrong!";
      const error = new Error(errorMessage);
      const result = logError(error);

      expect(result).to.equal("log deactivated in prod and stage");
      expect(consoleLogStub.notCalled).to.be.true;
      expect(consoleErrorStub.notCalled).to.be.true;

      process.env.NODE_ENV = originalNodeEnv;
      consoleLogStub.restore();
      consoleErrorStub.restore();
    });
  });
});
