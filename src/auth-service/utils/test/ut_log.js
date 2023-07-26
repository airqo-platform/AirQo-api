require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const winston = require("winston");
const MongoDB = require("winston-mongodb").MongoDB;
const {
  logText,
  logElement,
  logObject,
  logError,
  winstonLogger,
} = require("@utils/log");

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

  describe("winstonLogger", () => {
    it("should have the correct log level", () => {
      expect(winstonLogger.level).to.equal("info");
    });

    it("should have a MongoDB transport", () => {
      expect(winstonLogger.transports).to.be.an("array");
      expect(winstonLogger.transports).to.have.lengthOf(1);

      const transport = winstonLogger.transports[0];
      expect(transport).to.be.an.instanceOf(MongoDB);
    });

    it("should have the correct MongoDB transport options", () => {
      const transport = winstonLogger.transports[0];

      expect(transport.db).to.be.a("string"); // Replace with the correct value based on your LogDB function
      expect(transport.options).to.deep.equal({
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      expect(transport.collection).to.equal("logs");
      expect(transport.options).to.deep.equal({
        useUnifiedTopology: true,
      });
      expect(transport.format).to.be.an("object");
      expect(transport.format.timestamp).to.be.a("function");
      expect(transport.format.json).to.be.a("function");
      expect(transport.format.metadata).to.be.a("function");
      expect(transport.metaKey).to.equal("metadata");
      expect(transport.level).to.equal("info");
      expect(transport.schema).to.be.an("object"); // Replace with the correct value based on your LogSchema
      expect(transport.model).to.be.an("object"); // Replace with the correct value based on your LogModel
    });

    // You can add more tests for specific functionalities of the winstonLogger if needed
  });
});
