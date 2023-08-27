const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const { KafkaConsumer } = require("@bin/kafka-consumer"); // Update the path accordingly
const { Kafka } = require("kafkajs");

chai.use(chaiAsPromised);
const { expect } = chai;

describe("Kafka Consumer", () => {
  let sandbox;
  let kafkaConnectStub;
  let consumerRunStub;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  after(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    kafkaConnectStub = sandbox.stub(Kafka.prototype, "connect");
    consumerRunStub = sandbox.stub().resolves();
  });

  it("should connect to Kafka and subscribe to topics", async () => {
    const kafkaConsumer = KafkaConsumer.__get__("kafkaConsumer"); // Access the function you want to test
    const topicOperations = {
      topic1: sandbox.stub(),
      topic2: sandbox.stub(),
      // Add more stubbed topic operations as needed
    };

    const consumerRunArgs = [];

    sandbox.stub(Kafka.prototype, "consumer").returns({
      subscribe: sandbox.stub(),
      run: (config) => {
        consumerRunArgs.push(config);
        return consumerRunStub;
      },
    });

    await kafkaConsumer(topicOperations);

    expect(kafkaConnectStub.calledOnce).to.be.true;
    expect(consumerRunStub.calledOnce).to.be.true;
    expect(consumerRunArgs).to.have.lengthOf(
      Object.keys(topicOperations).length
    );

    // Here you can further test consumerRunArgs to check if each topic has the correct configuration
    // For example:
    expect(consumerRunArgs[0].eachMessage).to.be.a("function");
    // Add more assertions as needed
  });

  it("should handle errors during Kafka connection", async () => {
    const kafkaConsumer = KafkaConsumer.__get__("kafkaConsumer");

    const error = new Error("Connection error");

    kafkaConnectStub.rejects(error);

    await expect(kafkaConsumer({})).to.be.rejectedWith(
      `Error connecting to Kafka: ${JSON.stringify(error)}`
    );

    expect(kafkaConnectStub.calledOnce).to.be.true;
    expect(consumerRunStub.notCalled).to.be.true;
  });

  it("should handle errors during message processing", async () => {
    const kafkaConsumer = KafkaConsumer.__get__("kafkaConsumer");

    const topicOperations = {
      topic1: sandbox.stub().rejects(new Error("Processing error")),
    };

    consumerRunStub.rejects(new Error("Consumer error"));

    await expect(kafkaConsumer(topicOperations)).to.be.rejectedWith(
      "Consumer error"
    );

    expect(kafkaConnectStub.calledOnce).to.be.true;
    expect(consumerRunStub.calledOnce).to.be.true;
  });
});
