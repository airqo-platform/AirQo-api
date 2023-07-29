require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");

// Import the functions to be tested
const kafkaConsumer = require("@bin/kafka-consumer");
const createServer = require("@bin/server");
const main = require("@bin/index");

describe("Main Function", () => {
  let kafkaConsumerStub;
  let createServerStub;

  beforeEach(() => {
    kafkaConsumerStub = sinon.stub(kafkaConsumer);
    createServerStub = sinon.stub(createServer);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should call kafkaConsumer and createServer functions", async () => {
    try {
      // Call the main function
      await main();

      // Check if the kafkaConsumer and createServer functions are called
      expect(kafkaConsumerStub.calledOnce).to.be.true;
      expect(createServerStub.calledOnce).to.be.true;
    } catch (error) {
      throw error;
    }
  });

  it("should catch and log errors if main function throws an error", async () => {
    const errorToThrow = new Error("Test error");
    const consoleErrorSpy = sinon.spy(console, "error");

    // Stub the main function to throw an error
    sinon.stub(main, "kafkaConsumer").throws(errorToThrow);

    try {
      // Call the main function
      await main();

      // Check if the error is caught and logged
      expect(
        consoleErrorSpy.calledOnceWithExactly(
          "Error starting the application: ",
          errorToThrow
        )
      ).to.be.true;
    } catch (error) {
      throw error;
    } finally {
      // Restore the stubs and spies
      sinon.restore();
      consoleErrorSpy.restore();
    }
  });

  // Add more test cases as needed
});
