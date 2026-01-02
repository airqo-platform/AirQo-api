const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- kafka-util`);
const stringify = require("./stringify.util");

const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const producer = kafka.producer();

let producerConnected = false;

const connectProducer = async () => {
  if (!producerConnected) {
    try {
      await producer.connect();
      producerConnected = true;
      logger.info("Kafka producer connected successfully.");
    } catch (error) {
      logger.error("Failed to connect Kafka producer:", error);
      // Optional: implement a retry mechanism
    }
  }
};

// Connect the producer when the module is loaded.
connectProducer();

// Graceful shutdown
process.on("SIGINT", async () => {
  if (producerConnected) {
    await producer.disconnect();
    logger.info("Kafka producer disconnected due to application termination.");
  }
  process.exit();
});

const publishKafkaEvent = async (topic, event) => {
  if (!producerConnected) {
    logger.error(
      `Kafka producer not connected. Message for topic "${topic}" was not sent.`
    );
    return;
  }

  try {
    await producer.send({
      topic,
      messages: [{ value: stringify(event) }],
    });
  } catch (error) {
    logger.error(`Failed to send message to topic "${topic}":`, error);
  }
};

module.exports = { publishKafkaEvent };
