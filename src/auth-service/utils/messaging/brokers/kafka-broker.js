// src/utils/messaging/brokers/kafka-broker.js
const { Kafka } = require("kafkajs");
const BaseBroker = require("./base-broker");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- kafka-broker`);

class KafkaBroker extends BaseBroker {
  constructor(config = {}) {
    super(config);
    this.kafka = new Kafka({
      clientId: config.clientId || constants.KAFKA_CLIENT_ID,
      brokers: config.brokers || constants.KAFKA_BOOTSTRAP_SERVERS,
      ...config.kafkaOptions,
    });
    this.producer = null;
    this.consumer = null;
    this.consumerConnected = false;
    this.producerConnected = false;
  }

  getName() {
    return "kafka";
  }

  async connect() {
    try {
      // Create producer but don't connect yet
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        ...this.config.producerConfig,
      });

      this.isConnected = true;
      return true;
    } catch (error) {
      logger.error(`Failed to initialize Kafka broker: ${error.message}`);
      this.isConnected = false;
      throw error;
    }
  }

  async ensureProducerConnected() {
    if (!this.producerConnected) {
      try {
        await this.producer.connect();
        this.producerConnected = true;
      } catch (error) {
        logger.error(`Failed to connect Kafka producer: ${error.message}`);
        this.producerConnected = false;
        throw error;
      }
    }
  }

  async disconnect() {
    try {
      if (this.producerConnected && this.producer) {
        await this.producer.disconnect();
        this.producerConnected = false;
      }

      if (this.consumerConnected && this.consumer) {
        await this.consumer.disconnect();
        this.consumerConnected = false;
      }

      this.isConnected = false;
      return true;
    } catch (error) {
      logger.error(`Failed to disconnect from Kafka: ${error.message}`);
      throw error;
    }
  }

  async publishMessage(topic, message, key = null) {
    try {
      await this.ensureProducerConnected();

      const payload = {
        topic,
        messages: [
          {
            value:
              typeof message === "string" ? message : JSON.stringify(message),
            ...(key && { key }),
          },
        ],
      };

      await this.producer.send(payload);
      return true;
    } catch (error) {
      logger.error(`Failed to publish message to Kafka: ${error.message}`);
      this.producerConnected = false;
      throw error;
    }
  }

  async subscribe(topics, groupId, messageHandler) {
    try {
      // Create and connect consumer
      this.consumer = this.kafka.consumer({
        groupId: groupId || constants.UNIQUE_CONSUMER_GROUP,
      });

      await this.consumer.connect();
      this.consumerConnected = true;

      // Subscribe to all provided topics
      const topicsList = Array.isArray(topics) ? topics : [topics];
      await Promise.all(
        topicsList.map((topic) =>
          this.consumer.subscribe({ topic, fromBeginning: true })
        )
      );

      // Start consuming
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageValue = message.value.toString();
            await messageHandler(topic, messageValue);
          } catch (error) {
            logger.error(`Error processing Kafka message: ${error.message}`);
          }
        },
      });

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to Kafka topics: ${error.message}`);
      this.consumerConnected = false;
      throw error;
    }
  }

  isHealthy() {
    return this.isConnected;
  }
}

module.exports = KafkaBroker;
