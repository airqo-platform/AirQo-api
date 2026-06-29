require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const log4js = require("log4js");
const kafkaConsumer = require("@bin/jobs/kafka-consumer");
const createServer = require("@bin/server");
const constants = require("@config/constants");
const log4jsConfiguration = require("@config/log4js");

// Global hook: wait for MongoDB query connection if available, otherwise continue.
// @bin/server calls connectToMongoDB() at module scope so queryDB already exists.
before(function (done) {
  this.timeout(15000);
  const { connectToMongoDB } = require("@config/database");
  try {
    const { queryDB } = connectToMongoDB();
    // readyState 0 = disconnected (error already fired), 1 = connected — both are terminal
    if (!queryDB || queryDB.readyState === 0 || queryDB.readyState === 1) return done();
    // On success or error, just continue — DB tests fail on their own if DB unavailable
    queryDB.once("open", done);
    queryDB.once("error", () => done());
  } catch (_) {
    done();
  }
});

describe.skip("Application Initialization", () => {
  let loggerStub;
  let kafkaConsumerStub;
  let createServerStub;

  beforeEach(() => {
    // Stub the logger methods
    loggerStub = sinon.stub(log4js.getLogger(), "error");

    // Stub kafkaConsumer and createServer — module exports the function directly
    kafkaConsumerStub = sinon.stub({ kafkaConsumer }, "kafkaConsumer").resolves();
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
