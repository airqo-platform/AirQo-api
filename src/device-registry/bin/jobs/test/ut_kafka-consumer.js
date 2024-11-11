require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { Kafka } = require("kafkajs");
const log4js = require("log4js");
const constants = require("@config/constants");
const createEvent = require("@utils/create-event");
const kafkaConsumer = require("@bin/jobs/kafka-consumer");

describe("kafkaConsumer", () => {
  let consumerMock;
  let kafkaMock;
  let loggerMock;
  let createEventMock;

  beforeEach(() => {
    // Mock the Kafka consumer and its methods
    consumerMock = {
      connect: sinon.stub().resolves(),
      subscribe: sinon.stub().resolves(),
      run: sinon.stub().resolves(),
    };

    // Mock Kafka instance
    kafkaMock = {
      consumer: sinon.stub().returns(consumerMock),
    };

    // Mock logger
    loggerMock = {
      error: sinon.stub(),
    };

    // Mock createEvent
    createEventMock = {
      create: sinon.stub(),
    };

    // Setup stubs
    sinon.stub(Kafka.prototype, "consumer").returns(consumerMock);
    sinon.stub(log4js, "getLogger").returns(loggerMock);
    sinon.stub(createEvent, "create").returns(createEventMock.create);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Kafka Connection and Subscription", () => {
    it("should connect to Kafka and subscribe to the hourly-measurements topic", async () => {
      await kafkaConsumer();

      expect(consumerMock.connect.calledOnce).to.be.true;
      expect(consumerMock.subscribe.calledOnce).to.be.true;
      expect(
        consumerMock.subscribe.calledWith({
          topic: "hourly-measurements-topic",
          fromBeginning: false,
        })
      ).to.be.true;
    });

    it("should handle connection errors gracefully", async () => {
      const error = new Error("Connection failed");
      consumerMock.connect.rejects(error);

      await kafkaConsumer();

      expect(
        loggerMock.error.calledWith(
          `📶📶 Error connecting to Kafka: ${JSON.stringify(error)}`
        )
      ).to.be.true;
    });
  });

  describe("Message Processing", () => {
    it("should process valid hourly measurements successfully", async () => {
      const validMessage = {
        value: JSON.stringify({
          data: [
            {
              device_id: "device1",
              site_id: "site1",
              timestamp: "2024-01-01T00:00:00Z",
              pm2_5: 10,
              temperature: 25,
            },
          ],
        }),
      };

      createEventMock.create.resolves({ success: true });

      await consumerMock.run.callArgWith(0, {
        topic: "hourly-measurements-topic",
        partition: 0,
        message: validMessage,
      });

      expect(createEventMock.create.calledOnce).to.be.true;
      expect(
        console.log.calledWith("KAFKA: successfully stored the measurements")
      ).to.be.true;
    });

    it("should handle empty message data", async () => {
      const emptyMessage = {
        value: JSON.stringify({ data: [] }),
      };

      await consumerMock.run.callArgWith(0, {
        topic: "hourly-measurements-topic",
        partition: 0,
        message: emptyMessage,
      });

      expect(createEventMock.create.called).to.be.false;
    });

    it("should handle invalid JSON data", async () => {
      const invalidMessage = {
        value: "invalid json",
      };

      await consumerMock.run.callArgWith(0, {
        topic: "hourly-measurements-topic",
        partition: 0,
        message: invalidMessage,
      });

      expect(loggerMock.error.calledWith(sinon.match(/KAFKA: error message/)))
        .to.be.true;
    });

    it("should validate measurements against schema", async () => {
      const invalidData = {
        data: [
          {
            device_id: "", // Empty device_id should fail validation
            site_id: "site1",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      const message = {
        value: JSON.stringify(invalidData),
      };

      await consumerMock.run.callArgWith(0, {
        topic: "hourly-measurements-topic",
        partition: 0,
        message: message,
      });

      // Validation error should be logged
      expect(loggerMock.error.called).to.be.true;
    });

    it("should handle failed event creation", async () => {
      const validMessage = {
        value: JSON.stringify({
          data: [
            {
              device_id: "device1",
              site_id: "site1",
              timestamp: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      };

      createEventMock.create.resolves({ success: false });

      await consumerMock.run.callArgWith(0, {
        topic: "hourly-measurements-topic",
        partition: 0,
        message: validMessage,
      });

      expect(console.log.calledWith("KAFKA: failed to store the measurements"))
        .to.be.true;
    });
  });

  describe("Error Handling", () => {
    it("should handle unknown topics gracefully", async () => {
      await consumerMock.run.callArgWith(0, {
        topic: "unknown-topic",
        partition: 0,
        message: { value: "test" },
      });

      expect(
        loggerMock.error.calledWith(
          `🐛🐛 No operation defined for topic: unknown-topic`
        )
      ).to.be.true;
    });

    it("should handle message processing errors", async () => {
      const error = new Error("Processing failed");
      createEventMock.create.rejects(error);

      const validMessage = {
        value: JSON.stringify({
          data: [
            {
              device_id: "device1",
              site_id: "site1",
              timestamp: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      };

      await consumerMock.run.callArgWith(0, {
        topic: "hourly-measurements-topic",
        partition: 0,
        message: validMessage,
      });

      expect(loggerMock.error.calledWith(sinon.match(/KAFKA: error message/)))
        .to.be.true;
    });
  });
});
