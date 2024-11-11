require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const kafkaConsumer = require("@bin/jobs/kafka-consumer");

// Mock the required modules/functions
const constants = require("@config/constants");
const mailer = require("@utils/mailer");
const emailTemplates = require("@utils/email.templates");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");

describe("Kafka Consumer", () => {
  let kafkaStub;
  let consumerStub;
  let mailerStub;
  let loggerErrorStub;
  let loggerInfoStub;
  let jsonrepairStub;

  beforeEach(() => {
    // Create stubs for Kafka consumer
    consumerStub = {
      connect: sinon.stub().resolves(),
      subscribe: sinon.stub().resolves(),
      run: sinon.stub().resolves(),
    };

    kafkaStub = {
      consumer: sinon.stub().returns(consumerStub),
    };

    // Other stubs
    mailerStub = sinon.stub(mailer, "newMobileAppUser");
    loggerErrorStub = sinon.stub(console, "error");
    loggerInfoStub = sinon.stub(console, "info");
    jsonrepairStub = sinon.stub(jsonrepair);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should properly initialize and subscribe to all topics", async () => {
    const expectedTopics = ["ip-address", "deploy-topic", "recall-topic"];

    await kafkaConsumer();

    // Verify connection and subscription sequence
    expect(consumerStub.connect.calledOnce).to.be.true;

    // Verify subscriptions to all topics
    expectedTopics.forEach((topic) => {
      expect(
        consumerStub.subscribe.calledWith({
          topic,
          fromBeginning: true,
        })
      ).to.be.true;
    });

    // Verify consumer.run called once after all subscriptions
    expect(consumerStub.run.calledOnce).to.be.true;
    expect(consumerStub.run.calledAfter(consumerStub.subscribe)).to.be.true;
  });

  it("should handle messages for each topic correctly", async () => {
    // Simulate message processing by triggering the eachMessage callback
    consumerStub.run.callsFake(async ({ eachMessage }) => {
      await eachMessage({
        topic: "ip-address",
        partition: 0,
        message: { value: JSON.stringify({ ip: "192.168.1.1" }) },
      });
    });

    await kafkaConsumer();

    // Verify message processing
    expect(consumerStub.run.calledOnce).to.be.true;
    // Add specific verification for your message handlers
  });

  it("should handle Kafka connection errors", async () => {
    const connectionError = new Error("Kafka connection error");
    consumerStub.connect.rejects(connectionError);

    await kafkaConsumer();

    expect(
      loggerErrorStub.calledWith(
        `📶📶 Error connecting to Kafka: ${connectionError}`
      )
    ).to.be.true;
  });

  it("should handle message processing errors", async () => {
    consumerStub.run.callsFake(async ({ eachMessage }) => {
      await eachMessage({
        topic: "ip-address",
        partition: 0,
        message: { value: "invalid-json" },
      });
    });

    await kafkaConsumer();

    expect(loggerErrorStub.called).to.be.true;
  });

  it("should handle undefined topic operations", async () => {
    consumerStub.run.callsFake(async ({ eachMessage }) => {
      await eachMessage({
        topic: "unknown-topic",
        partition: 0,
        message: { value: "test" },
      });
    });

    await kafkaConsumer();

    expect(
      loggerErrorStub.calledWith(
        "🐛🐛 No operation defined for topic: unknown-topic"
      )
    ).to.be.true;
  });

  it("should subscribe to all topics before starting consumer", async () => {
    const subscribePromises = [];
    consumerStub.subscribe.callsFake(() => {
      return new Promise((resolve) => {
        subscribePromises.push(resolve);
      });
    });

    const consumerPromise = kafkaConsumer();

    // Resolve all subscriptions
    subscribePromises.forEach((resolve) => resolve());

    await consumerPromise;

    // Verify that run was called after all subscriptions were complete
    expect(consumerStub.run.calledAfter(consumerStub.subscribe)).to.be.true;
  });
});
