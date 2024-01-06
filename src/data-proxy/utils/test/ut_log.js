const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const { logText, logElement, logObject, logError } = require("../log");

describe("Logging Utility Functions", () => {
    describe("logText", () => {
        it("should log a message when not in production", () => {
            const consoleLogStub = sinon.stub(console, "log");
            process.env.NODE_ENV = "development";
            const result = logText("Test log message");
            expect(consoleLogStub.calledOnce).to.be.true;
            expect(consoleLogStub.calledWith("Test log message")).to.be.true;
            consoleLogStub.restore();
            process.env.NODE_ENV = "test";
        });

        it("should return a log deactivation message in production", () => {
            const consoleLogStub = sinon.stub(console, "log");
            process.env.NODE_ENV = "production";
            const result = logText("Test log message");
            expect(consoleLogStub.notCalled).to.be.true;
            expect(result).to.equal("log deactivated in prod and stage");
            consoleLogStub.restore();
            process.env.NODE_ENV = "test";
        });
    });

    describe("logElement", () => {
        it("should log an element when not in production", () => {
            const consoleLogStub = sinon.stub(console, "log");
            process.env.NODE_ENV = "development";
            const result = logElement("Test", "Element");
            expect(consoleLogStub.calledOnce).to.be.true;
            expect(consoleLogStub.calledWith("Test: Element")).to.be.true;
            consoleLogStub.restore();
            process.env.NODE_ENV = "test";
        });
    });

    describe("logObject", () => {
        it("should log an object when not in production", () => {
            const consoleLogStub = sinon.stub(console, "log");
            process.env.NODE_ENV = "development";
            const result = logObject("Test", { key: "value" });
            expect(consoleLogStub.calledOnce).to.be.true;
            expect(consoleLogStub.calledWith("Test: ")).to.be.true;
            consoleLogStub.restore();
            process.env.NODE_ENV = "test";
        });
    });

    describe("logError", () => {
        it("should log an error when not in production", () => {
            const consoleErrorStub = sinon.stub(console, "error");
            process.env.NODE_ENV = "development";
            const error = new Error("Test error message");
            const result = logError(error);
            expect(consoleErrorStub.calledOnce).to.be.true;
            expect(consoleErrorStub.calledWith(error)).to.be.true;
            consoleErrorStub.restore();
            process.env.NODE_ENV = "test";
        });

    });
});
