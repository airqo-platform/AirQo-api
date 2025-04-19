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
      connectionTimeout: constants.MESSAGE_BROKER_CONNECTION_TIMEOUT_MS || 5000,
      ...config.kafkaOptions,
    });
    this.producer = null;
    this.consumer = null;
    this.consumerConnected = false;
    this.producerConnected = false;
    this.connectionTimeout =
      constants.MESSAGE_BROKER_CONNECTION_TIMEOUT_MS || 5000;
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
      return false;
    }
  }

  async ensureProducerConnected() {
    if (!this.producerConnected) {
      try {
        // Connect with timeout
        const connectPromise = this.producer.connect();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Kafka producer connection timed out after ${this.connectionTimeout}ms`
                )
              ),
            this.connectionTimeout
          )
        );

        await Promise.race([connectPromise, timeoutPromise]);
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
        // Disconnect with timeout
        const disconnectPromise = this.producer.disconnect();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Kafka producer disconnect timed out after ${this.connectionTimeout}ms`
                )
              ),
            this.connectionTimeout
          )
        );

        await Promise.race([disconnectPromise, timeoutPromise]);
        this.producerConnected = false;
      }

      if (this.consumerConnected && this.consumer) {
        // Disconnect with timeout
        const disconnectPromise = this.consumer.disconnect();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Kafka consumer disconnect timed out after ${this.connectionTimeout}ms`
                )
              ),
            this.connectionTimeout
          )
        );

        await Promise.race([disconnectPromise, timeoutPromise]);
        this.consumerConnected = false;
      }

      this.isConnected = false;
      return true;
    } catch (error) {
      logger.error(`Failed to disconnect from Kafka: ${error.message}`);
      return false; // Don't throw, just return false
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

      // Send with timeout
      const sendPromise = this.producer.send(payload);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Kafka publish to ${topic} timed out after ${this.connectionTimeout}ms`
              )
            ),
          this.connectionTimeout
        )
      );

      await Promise.race([sendPromise, timeoutPromise]);
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

      // Connect with timeout
      const connectPromise = this.consumer.connect();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Kafka consumer connection timed out after ${this.connectionTimeout}ms`
              )
            ),
          this.connectionTimeout
        )
      );

      await Promise.race([connectPromise, timeoutPromise]);
      this.consumerConnected = true;

      // Subscribe to all provided topics
      const topicsList = Array.isArray(topics) ? topics : [topics];
      await Promise.all(
        topicsList.map(async (topic) => {
          // Subscribe with timeout
          const subscribePromise = this.consumer.subscribe({
            topic,
            fromBeginning: true,
          });
          const subTimeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Kafka subscribe to ${topic} timed out after ${this.connectionTimeout}ms`
                  )
                ),
              this.connectionTimeout
            )
          );

          await Promise.race([subscribePromise, subTimeoutPromise]);
        })
      );

      // Start consuming
      const runPromise = this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const messageValue = message.value.toString();
            await messageHandler(topic, messageValue);
          } catch (error) {
            logger.error(`Error processing Kafka message: ${error.message}`);
          }
        },
      });

      const runTimeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Kafka consumer.run timed out after ${this.connectionTimeout}ms`
              )
            ),
          this.connectionTimeout
        )
      );

      await Promise.race([runPromise, runTimeoutPromise]);

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to Kafka topics: ${error.message}`);
      this.consumerConnected = false;
      return false; // Don't throw, just return false
    }
  }

  isHealthy() {
    return this.isConnected;
  }
}

module.exports = KafkaBroker;
