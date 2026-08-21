require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire").noCallThru();

// Mock the required modules/functions
const { mailer } = require("@utils/common");

describe("Kafka Consumer", () => {
  let kafkaConsumer;
  let kafkaStub;
  let consumerStub;
  let mailerStub;
  let loggerStub;
  let loggerErrorStub;
  let loggerInfoStub;

  beforeEach(() => {
    // The real kafkajs client throws if UNIQUE_CONSUMER_GROUP is unset when
    // `.consumer()` is called. The Kafka class itself is fully mocked below,
    // so this is just defensive in case that ever changes.
    process.env.UNIQUE_CONSUMER_GROUP = "test-consumer-group";

    // Stubs for the Kafka consumer instance returned by `kafka.consumer()`
    consumerStub = {
      connect: sinon.stub().resolves(),
      subscribe: sinon.stub().resolves(),
      run: sinon.stub().resolves(),
    };

    kafkaStub = {
      consumer: sinon.stub().returns(consumerStub),
    };

    // `new Kafka(...)` normally builds a real kafkajs client. Returning an
    // object from a constructor overrides the default `this`, so `new
    // KafkaMock()` yields our stub instance instead.
    function KafkaMock() {
      return kafkaStub;
    }

    // Fake logger so we can assert on logger.error/info calls directly,
    // instead of depending on log4js's own appenders (which are silenced
    // in the test environment and never touch console.error/info).
    loggerStub = {
      error: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub(),
      trace: sinon.stub(),
    };
    loggerErrorStub = loggerStub.error;
    loggerInfoStub = loggerStub.info;

    mailerStub = sinon.stub(mailer, "newMobileAppUser");

    // Re-require the module under test with `kafkajs` and `log4js` proxied
    // in, so the stubs above are actually exercised by the code under test.
    kafkaConsumer = proxyquire("../kafka-consumer", {
      kafkajs: { Kafka: KafkaMock },
      log4js: {
        getLogger: () => loggerStub,
      },
    });
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
  });

  it("should handle Kafka connection errors", async () => {
    const connectionError = new Error("Kafka connection error");
    consumerStub.connect.rejects(connectionError);

    await kafkaConsumer();

    expect(loggerErrorStub.called).to.be.true;
    const loggedMessage = loggerErrorStub.getCall(0).args[0];
    expect(loggedMessage).to.include("Error connecting to Kafka");
    expect(loggedMessage).to.include("Kafka connection error");
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

    // Let the pending `connect()` continuation run so `subscribe()` has
    // actually been invoked for every topic before we resolve them.
    await new Promise((resolve) => setImmediate(resolve));

    // Resolve all subscriptions
    subscribePromises.forEach((resolve) => resolve());

    await consumerPromise;

    // Verify that run was called after all subscriptions were complete
    expect(consumerStub.run.calledAfter(consumerStub.subscribe)).to.be.true;
  });
});
