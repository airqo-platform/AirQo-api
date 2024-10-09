require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const log4js = require("log4js");
const kafkaConsumer = require("@bin/jobs/kafka-consumer");
const createServer = require("@bin/server");
const constants = require("@config/constants");
const log4jsConfiguration = require("@config/log4js");

describe("Application Initialization", () => {
  let loggerStub;
  let kafkaConsumerStub;
  let createServerStub;

  beforeEach(() => {
    // Stub the logger methods
    loggerStub = sinon.stub(log4js.getLogger(), "error");

    // Stub kafkaConsumer and createServer
    kafkaConsumerStub = sinon.stub(kafkaConsumer, "default").resolves();
    createServerStub = sinon.stub(createServer);

    // Configure log4js for testing
    log4js.configure(log4jsConfiguration);
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it("should start the Kafka consumer and create the server", async () => {
    await main(); // Call the main function

    expect(kafkaConsumerStub.calledOnce).to.be.true; // Check if kafkaConsumer was called
    expect(createServerStub.calledOnce).to.be.true; // Check if createServer was called
  });

  it("should log an error if starting Kafka fails", async () => {
    const errorMessage = "Kafka connection error";
    kafkaConsumerStub.rejects(new Error(errorMessage)); // Simulate an error from kafkaConsumer

    await main(); // Call the main function

    expect(
      loggerStub.calledWithMatch(
        sinon.match.string,
        sinon.match({ message: errorMessage })
      )
    ).to.be.true;
  });

  it("should log an error if creating the server fails", async () => {
    const errorMessage = "Server creation error";
    kafkaConsumerStub.resolves(); // Ensure kafkaConsumer resolves
    createServerStub.throws(new Error(errorMessage)); // Simulate an error from createServer

    await main(); // Call the main function

    expect(
      loggerStub.calledWithMatch(
        sinon.match.string,
        sinon.match({ message: errorMessage })
      )
    ).to.be.true;
  });

  it("should handle errors thrown during application startup", async () => {
    const startupError = new Error("Startup error");

    // Simulate an error during startup
    sinon.stub(console, "error"); // Stub console.error to suppress output during tests
    await main().catch(() => {});

    expect(
      loggerStub.calledWithMatch(
        sinon.match.string,
        sinon.match({ message: startupError.message })
      )
    ).to.be.true;
  });
});
