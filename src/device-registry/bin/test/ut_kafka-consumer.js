require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const kafkaConsumer = require("@bin/kafka-consumer"); // Replace with the actual path to your kafkaConsumer.js file

describe("kafkaConsumer", () => {
  let consumerMock;
  let connectSpy;
  let subscribeSpy;
  let runStub;
  let consumeHourlyMeasurementsStub;
  let operationFunction2Stub;

  beforeEach(() => {
    // Mock the Kafka consumer and its methods
    consumerMock = {
      connect: sinon.stub(),
      subscribe: sinon.stub(),
      run: sinon.stub(),
    };
    connectSpy = consumerMock.connect;
    subscribeSpy = consumerMock.subscribe;
    runStub = consumerMock.run;

    // Stub the topic operations functions
    consumeHourlyMeasurementsStub = sinon.stub();
    operationFunction2Stub = sinon.stub();

    // Define the topic-to-operation function mapping
    const topicOperations = {
      [constants.HOURLY_MEASUREMENTS_TOPIC]: consumeHourlyMeasurementsStub,
      topic2: operationFunction2Stub,
      // Add more topics and their corresponding functions as needed
    };

    // Replace the Kafka consumer with the mock
    sinon.stub(Kafka.prototype, "consumer").returns(consumerMock);

    // Call the kafkaConsumer function with the mocked topicOperations
    kafkaConsumer(topicOperations);
  });

  afterEach(() => {
    // Restore the original Kafka.prototype.consumer
    Kafka.prototype.consumer.restore();
    // Reset the stubs and spies
    connectSpy.reset();
    subscribeSpy.reset();
    runStub.reset();
    consumeHourlyMeasurementsStub.reset();
    operationFunction2Stub.reset();
  });

  it("should connect to Kafka and subscribe to all topics", async () => {
    // Check that the consumer connects and subscribes to all topics
    expect(connectSpy.calledOnce).to.be.true;
    expect(subscribeSpy.calledOnce).to.be.true;
    // Replace "topic2" with your actual topic name
    expect(subscribeSpy.calledWith({ topic: "topic2", fromBeginning: true })).to
      .be.true;
    // Add more topic expectations if needed
  });

  it("should consume hourly measurements for the HOURLY_MEASUREMENTS_TOPIC", async () => {
    // Create a sample Kafka message
    const sampleMessage = {
      topic: constants.HOURLY_MEASUREMENTS_TOPIC,
      partition: 0,
      message: {
        value: Buffer.from("Sample Kafka Message"),
      },
    };

    // Simulate the consumer.run callback with the sample message
    await runStub.callArgWith(0, sampleMessage);

    // Check that the consumeHourlyMeasurementsStub function was called with the correct message data
    expect(consumeHourlyMeasurementsStub.calledOnce).to.be.true;
    // Replace the data parameter with the expected message data for the consumeHourlyMeasurements function
    expect(consumeHourlyMeasurementsStub.calledWith("Sample Kafka Message")).to
      .be.true;
  });

  it("should handle errors when processing Kafka messages", async () => {
    // Create a sample Kafka message with an unknown topic
    const unknownTopicMessage = {
      topic: "unknown-topic",
      partition: 0,
      message: {
        value: Buffer.from("Sample Kafka Message"),
      },
    };

    // Simulate the consumer.run callback with the unknown topic message
    await runStub.callArgWith(0, unknownTopicMessage);

    // Check that the error is logged for the unknown topic
    expect(logger.error.calledOnce).to.be.true;
    expect(
      logger.error.calledWith(
        `No operation defined for topic: ${unknownTopicMessage.topic}`
      )
    ).to.be.true;
  });

  // Add more tests for other topics and scenarios as needed
});
