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
let isConnecting = false;
let isShuttingDown = false;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

const connectProducer = async (retryCount = 0) => {
  if (isConnecting || producerConnected) return;
  isConnecting = true;

  try {
    await producer.connect();
    producerConnected = true;
    isConnecting = false;
    logger.info("✅ Kafka producer connected successfully.");
  } catch (error) {
    isConnecting = false;
    logger.error(`❌ Failed to connect Kafka producer: ${error.message}`);

    if (retryCount < MAX_RETRIES && !isShuttingDown) {
      const delay =
        INITIAL_RETRY_DELAY * Math.pow(2, retryCount) + Math.random() * 1000;
      logger.info(
        `Retrying Kafka connection in ${Math.round(
          delay / 1000
        )}s... (Attempt ${retryCount + 1}/${MAX_RETRIES})`
      );
      setTimeout(() => connectProducer(retryCount + 1), delay);
    } else {
      logger.error(
        "💀 Max Kafka connection retries reached. Producer will not connect."
      );
    }
  }
};

// Event listeners for the producer
producer.on(producer.events.CONNECT, () => {
  logger.info("Internal Kafka producer has connected to the broker.");
});

producer.on(producer.events.DISCONNECT, () => {
  logger.warn("🔥 Kafka producer disconnected. Attempting to reconnect...");
  producerConnected = false;
  if (!isShuttingDown) {
    try {
      connectProducer();
    } catch (error) {
      logger.error(`Error during reconnect attempt: ${error.message}`);
    }
  }
});

// Connect the producer when the module is loaded.
connectProducer();

// Graceful shutdown
process.on("SIGINT", async () => {
  isShuttingDown = true;
  if (producerConnected) {
    await producer.disconnect();
    logger.info("Kafka producer disconnected due to application termination.");
  }
  process.exit();
});

const publishKafkaEvent = async (topic, event) => {
  if (!producerConnected) {
    const errorMessage = `Kafka producer not connected. Message for topic "${topic}" was not sent.`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
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
