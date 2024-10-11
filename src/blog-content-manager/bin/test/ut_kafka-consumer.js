require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const kafkaConsumer = require("@bin/kafka-consumer");

// Mock the required modules/functions
const constants = require("@config/constants");
const mailer = require("@utils/mailer");
const emailTemplates = require("@utils/email.templates");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");

describe("Kafka Consumer", () => {
  let connectStub;
  let subscribeStub;
  let runStub;
  let mailerStub;
  let loggerErrorStub;
  let loggerInfoStub;
  let jsonrepairStub;

  beforeEach(() => {
    // Create stubs for required modules/functions
    connectStub = sinon.stub();
    subscribeStub = sinon.stub();
    runStub = sinon.stub();
    mailerStub = sinon.stub(mailer, "newMobileAppUser");
    loggerErrorStub = sinon.stub(console, "error");
    loggerInfoStub = sinon.stub(console, "info");
    jsonrepairStub = sinon.stub(jsonrepair);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should consume messages from the Kafka broker", async () => {
    // Set up the topic-to-operation function mapping
    const operationFunction1 = sinon.stub();
    const operationFunction2 = sinon.stub();
    const topicOperations = {
      [constants.NEW_MOBILE_APP_USER_TOPIC]: operationFunction1,
      topic2: operationFunction2,
    };

    // Stub the required Kafka functions
    connectStub.resolves();
    subscribeStub.resolves();
    runStub.callsFake(async (options) => {
      const { eachMessage } = options;
      const fakeMessage = {
        topic: constants.NEW_MOBILE_APP_USER_TOPIC,
        partition: 0,
        message: {
          value: "testMessageData",
        },
      };
      await eachMessage(fakeMessage);
    });

    try {
      // Call the kafkaConsumer function
      await kafkaConsumer();

      // Check if Kafka functions are called with the correct arguments
      expect(connectStub.calledOnce).to.be.true;
      expect(
        subscribeStub.calledOnceWithExactly({
          topic: constants.NEW_MOBILE_APP_USER_TOPIC,
          fromBeginning: true,
        })
      ).to.be.true;
      expect(runStub.calledOnce).to.be.true;
      expect(operationFunction1.calledOnceWithExactly("testMessageData")).to.be
        .true;
      expect(operationFunction2.notCalled).to.be.true; // topic2 not subscribed, so operationFunction2 should not be called
    } catch (error) {
      throw error;
    }
  });

  it("should handle Kafka errors", async () => {
    // Stub the required Kafka functions to throw an error
    connectStub.rejects(new Error("Kafka connection error"));

    try {
      // Call the kafkaConsumer function
      await kafkaConsumer();

      // Check if the error is caught and logged
      expect(
        loggerErrorStub.calledOnceWithExactly(
          "Error connecting to Kafka: Kafka connection error"
        )
      ).to.be.true;
    } catch (error) {
      throw error;
    }
  });

  it("should handle topic without operation function", async () => {
    // Set up the topic-to-operation function mapping without an operation for topic2
    const operationFunction1 = sinon.stub();
    const topicOperations = {
      [constants.NEW_MOBILE_APP_USER_TOPIC]: operationFunction1,
      // No operation for topic2
    };

    // Stub the required Kafka functions
    connectStub.resolves();
    subscribeStub.resolves();
    runStub.callsFake(async (options) => {
      const { eachMessage } = options;
      const fakeMessage = {
        topic: "topic2", // topic2 without a defined operation
        partition: 0,
        message: {
          value: "testMessageData",
        },
      };
      await eachMessage(fakeMessage);
    });

    try {
      // Call the kafkaConsumer function
      await kafkaConsumer();

      // Check if the error is caught and logged
      expect(
        loggerErrorStub.calledOnceWithExactly(
          "No operation defined for topic: topic2"
        )
      ).to.be.true;
    } catch (error) {
      throw error;
    }
  });

  it("should handle error in operation function", async () => {
    // Set up the topic-to-operation function mapping with an operation function that throws an error
    const operationFunction1 = sinon
      .stub()
      .throws(new Error("Test operation function error"));
    const topicOperations = {
      [constants.NEW_MOBILE_APP_USER_TOPIC]: operationFunction1,
    };

    // Stub the required Kafka functions
    connectStub.resolves();
    subscribeStub.resolves();
    runStub.callsFake(async (options) => {
      const { eachMessage } = options;
      const fakeMessage = {
        topic: constants.NEW_MOBILE_APP_USER_TOPIC,
        partition: 0,
        message: {
          value: "testMessageData",
        },
      };
      await eachMessage(fakeMessage);
    });

    try {
      // Call the kafkaConsumer function
      await kafkaConsumer();

      // Check if the error is caught and logged
      expect(
        loggerErrorStub.calledOnceWithExactly(
          "Error processing Kafka message for topic NEW_MOBILE_APP_USER_TOPIC: Error: Test operation function error"
        )
      ).to.be.true;
    } catch (error) {
      throw error;
    }
  });

  it("should handle successful operation function", async () => {
    // Set up the topic-to-operation function mapping with a successful operation function
    const operationFunction1 = sinon.stub();
    const topicOperations = {
      [constants.NEW_MOBILE_APP_USER_TOPIC]: operationFunction1,
    };

    // Stub the required Kafka functions
    connectStub.resolves();
    subscribeStub.resolves();
    runStub.callsFake(async (options) => {
      const { eachMessage } = options;
      const fakeMessage = {
        topic: constants.NEW_MOBILE_APP_USER_TOPIC,
        partition: 0,
        message: {
          value: "testMessageData",
        },
      };
      await eachMessage(fakeMessage);
    });

    // Stub the mailer function to return a success response
    mailerStub.resolves({ success: true });

    try {
      // Call the kafkaConsumer function
      await kafkaConsumer();

      // Check if the operation function is called and the success response is logged
      expect(operationFunction1.calledOnceWithExactly("testMessageData")).to.be
        .true;
      expect(
        loggerInfoStub.calledOnceWithExactly(
          'KAFKA: successfully received the new Mobile App User --- {"success":true}'
        )
      ).to.be.true;
    } catch (error) {
      throw error;
    }
  });

  // Add more test cases as needed
});
