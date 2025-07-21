require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const winston = require("winston");
const { MongoDB } = require("winston-mongodb");
const { LogDB, LogModel, winstonLogger } = require("@utils/log-winston");

describe("winstonLogger", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("should create the winston logger with the correct configurations", () => {
    const createLoggerStub = sinon.stub(winston, "createLogger");
    const mongoDBTransportStub = sinon.stub(winston.transports, "MongoDB");

    const logger = winstonLogger;

    expect(createLoggerStub.calledOnce).to.be.true;
    expect(mongoDBTransportStub.calledOnce).to.be.true;

    const transportOptions = mongoDBTransportStub.getCall(0).args[0];

    // Ensure the MongoDB transport is created with the correct options
    expect(transportOptions).to.deep.equal({
      db: LogDB("airqo"),
      options: { useNewUrlParser: true, useUnifiedTopology: true },
      collection: "logs",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.metadata()
      ),
      metaKey: "metadata",
      level: "info",
      schema: LogSchema,
      model: LogModel("airqo"),
    });
  });
});

// You can add more test cases to cover additional scenarios or edge cases.
