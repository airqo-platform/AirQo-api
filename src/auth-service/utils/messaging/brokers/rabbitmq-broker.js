// src/utils/messaging/brokers/rabbitmq-broker.js
const amqp = require("amqplib");
const BaseBroker = require("./base-broker");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- rabbitmq-broker`);

class RabbitMQBroker extends BaseBroker {
  constructor(config = {}) {
    super(config);
    this.connection = null;
    this.channel = null;
    this.consumers = new Map();
    this.reconnectTimer = null;
    this.reconnectDelay = config.reconnectDelay || 5000; // 5 seconds
  }

  getName() {
    return "rabbitmq";
  }

  getConnectionString() {
    const host = this.config.host || constants.RABBITMQ_HOST || "localhost";
    const port = this.config.port || constants.RABBITMQ_PORT || 5672;
    const username =
      this.config.username || constants.RABBITMQ_USERNAME || "guest";
    const password =
      this.config.password || constants.RABBITMQ_PASSWORD || "guest";
    const vhost = this.config.vhost || constants.RABBITMQ_VHOST || "/";

    return `amqp://${username}:${password}@${host}:${port}${vhost}`;
  }

  async connect() {
    try {
      if (this.connection) {
        return true;
      }

      const url = this.getConnectionString();
      this.connection = await amqp.connect(url);

      // Handle connection loss
      this.connection.on("error", (err) => {
        logger.error(`RabbitMQ connection error: ${err.message}`);
        this.handleDisconnect();
      });

      this.connection.on("close", () => {
        logger.warn("RabbitMQ connection closed");
        this.handleDisconnect();
      });

      // Create channel
      this.channel = await this.connection.createChannel();
      this.isConnected = true;

      logger.info("Connected to RabbitMQ");
      return true;
    } catch (error) {
      logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      this.isConnected = false;
      this.handleDisconnect();
      throw error;
    }
  }

  handleDisconnect() {
    this.isConnected = false;
    this.channel = null;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Try to reconnect
    this.reconnectTimer = setTimeout(async () => {
      try {
        logger.info("Attempting to reconnect to RabbitMQ...");
        await this.connect();

        // Restore all consumers
        for (const [queue, consumerInfo] of this.consumers.entries()) {
          await this.setupQueue(queue);
          await this.channel.consume(queue, consumerInfo.handler, {
            noAck: true,
          });
        }
      } catch (error) {
        logger.error(`Failed to reconnect to RabbitMQ: ${error.message}`);
      }
    }, this.reconnectDelay);
  }

  async disconnect() {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.channel) {
        await this.channel.close();
      }

      if (this.connection) {
        await this.connection.close();
      }

      this.channel = null;
      this.connection = null;
      this.isConnected = false;

      return true;
    } catch (error) {
      logger.error(`Failed to disconnect from RabbitMQ: ${error.message}`);
      throw error;
    }
  }

  async setupQueue(topic) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Ensure queue exists with durability
      await this.channel.assertQueue(topic, {
        durable: true,
        // Additional queue options can be added here
      });
    } catch (error) {
      logger.error(`Failed to setup RabbitMQ queue: ${error.message}`);
      throw error;
    }
  }

  async publishMessage(topic, message, messageId = null) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // Ensure queue exists
      await this.setupQueue(topic);

      const payload = Buffer.from(
        typeof message === "string" ? message : JSON.stringify(message)
      );

      const options = {
        persistent: true, // Make message persistent
        ...(messageId && { messageId }),
      };

      await this.channel.sendToQueue(topic, payload, options);
      return true;
    } catch (error) {
      logger.error(`Failed to publish message to RabbitMQ: ${error.message}`);
      this.isConnected = false;
      throw error;
    }
  }

  async subscribe(topics, groupId, messageHandler) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const topicsList = Array.isArray(topics) ? topics : [topics];

      for (const topic of topicsList) {
        // Ensure queue exists
        await this.setupQueue(topic);

        const handler = async (msg) => {
          if (!msg) return;

          try {
            const content = msg.content.toString();
            await messageHandler(topic, content);
          } catch (error) {
            logger.error(`Error processing RabbitMQ message: ${error.message}`);
          }
        };

        // Save handler for reconnection scenarios
        this.consumers.set(topic, { handler });

        // Start consuming
        await this.channel.consume(topic, handler, { noAck: true });
      }

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to RabbitMQ topics: ${error.message}`);
      this.isConnected = false;
      throw error;
    }
  }

  isHealthy() {
    return this.isConnected && this.channel !== null;
  }
}

module.exports = RabbitMQBroker;
