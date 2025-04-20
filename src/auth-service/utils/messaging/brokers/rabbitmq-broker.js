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
    this.connectionTimeout =
      constants.MESSAGE_BROKER_CONNECTION_TIMEOUT_MS || 5000;
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

    const rawVhost = this.config.vhost || constants.RABBITMQ_VHOST || "/";
    const vhost = rawVhost.startsWith("/") ? rawVhost : `/${rawVhost}`;
    return `amqp://${username}:${password}@${host}:${port}${vhost}`;
  }

  async connect() {
    try {
      if (this.connection) {
        return true;
      }

      const url = this.getConnectionString();

      // Connect with timeout
      const connectPromise = amqp.connect(url);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `RabbitMQ connection timed out after ${this.connectionTimeout}ms`
              )
            ),
          this.connectionTimeout
        )
      );

      this.connection = await Promise.race([connectPromise, timeoutPromise]);

      // Handle connection loss
      this.connection.on("error", (err) => {
        logger.error(`RabbitMQ connection error: ${err.message}`);
        this.handleDisconnect();
      });

      this.connection.on("close", () => {
        logger.warn("RabbitMQ connection closed");
        this.handleDisconnect();
      });

      // Create channel with timeout
      const channelPromise = this.connection.createChannel();
      const channelTimeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `RabbitMQ channel creation timed out after ${this.connectionTimeout}ms`
              )
            ),
          this.connectionTimeout
        )
      );

      this.channel = await Promise.race([
        channelPromise,
        channelTimeoutPromise,
      ]);

      this.isConnected = true;

      logger.info("Connected to RabbitMQ");
      return true;
    } catch (error) {
      logger.error(`Failed to connect to RabbitMQ: ${error.message}`);
      this.isConnected = false;
      this.handleDisconnect();
      return false;
    }
  }

  handleDisconnect() {
    this.isConnected = false;
    this.channel = null;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    // Try to reconnect
    const attemptReconnect = async () => {
      try {
        logger.info("Attempting to reconnect to RabbitMQ...");
        const connected = await this.connect();

        if (connected) {
          // Restore all consumers
          for (const [queue, consumerInfo] of this.consumers.entries()) {
            try {
              await this.setupQueue(queue);
              await this.channel.consume(queue, consumerInfo.handler, {
                noAck: true,
              });
            } catch (error) {
              logger.error(
                `Failed to restore consumer for queue ${queue}: ${error.message}`
              );
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to reconnect to RabbitMQ: ${error.message}`);
        // Schedule another reconnection attempt
        this.reconnectTimer = setTimeout(attemptReconnect, this.reconnectDelay);
      }
    }; // Start the reconnection process
    this.reconnectTimer = setTimeout(attemptReconnect, this.reconnectDelay);
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
      return false; // Don't throw, just return false
    }
  }

  async setupQueue(topic) {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error("Not connected to RabbitMQ");
        }
      }

      // Ensure queue exists with durability
      const queuePromise = this.channel.assertQueue(topic, {
        durable: true,
        // Additional queue options can be added here
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Queue setup timed out for ${topic}`)),
          this.connectionTimeout
        )
      );

      await Promise.race([queuePromise, timeoutPromise]);
    } catch (error) {
      logger.error(`Failed to setup RabbitMQ queue: ${error.message}`);
      throw error;
    }
  }

  async publishMessage(topic, message, messageId = null) {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error("Failed to connect to RabbitMQ");
        }
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

      // Send message with timeout
      const sendPromise = this.channel.sendToQueue(topic, payload, options);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Publish to ${topic} timed out`)),
          this.connectionTimeout
        )
      );

      await Promise.race([sendPromise, timeoutPromise]);
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
        const connected = await this.connect();
        if (!connected) {
          throw new Error("Failed to connect to RabbitMQ");
        }
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

        // Start consuming with timeout
        const consumePromise = this.channel.consume(topic, handler, {
          noAck: true,
        });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Subscribe to ${topic} timed out`)),
            this.connectionTimeout
          )
        );

        await Promise.race([consumePromise, timeoutPromise]);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to RabbitMQ topics: ${error.message}`);
      this.isConnected = false;
      return false; // Don't throw, just return false
    }
  }

  isHealthy() {
    return this.isConnected && this.channel !== null;
  }
}

module.exports = RabbitMQBroker;
