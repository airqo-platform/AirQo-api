// src/utils/messaging/brokers/nats-broker.js
const { connect } = require("nats");
const BaseBroker = require("./base-broker");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- nats-broker`);

class NatsBroker extends BaseBroker {
  constructor(config = {}) {
    super(config);
    this.client = null;
    this.subscriptions = new Map();
    this.reconnectDelay = config.reconnectDelay || 5000; // 5 seconds
    this.connectionTimeout =
      constants.MESSAGE_BROKER_CONNECTION_TIMEOUT_MS || 5000;
  }

  getName() {
    return "nats";
  }

  async connect() {
    try {
      // Set connection timeout from constants or use default
      const connectionTimeout = this.connectionTimeout;

      const options = {
        servers: this.config.servers ||
          constants.NATS_SERVERS || ["nats://localhost:4222"],
        timeout: connectionTimeout, // Use the timeout from constants
        pingInterval: this.config.pingInterval || 10000,
        reconnect: true,
        maxReconnectAttempts: this.config.maxReconnectAttempts || 10,
        reconnectTimeWait: this.reconnectDelay,
      };

      // Create a promise that will reject after the timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(`NATS connection timed out after ${connectionTimeout}ms`)
          );
        }, connectionTimeout);
      });

      // Attempt to connect with a timeout
      const connectPromise = connect(options);
      this.client = await Promise.race([connectPromise, timeoutPromise]);

      this.client.closed().then(() => {
        logger.warn("NATS connection closed");
        this.isConnected = false;
      });

      this.isConnected = true;
      logger.info("Connected to NATS");
      return true;
    } catch (error) {
      logger.error(`Failed to connect to NATS: ${error.message}`);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.client = null;
      }

      this.isConnected = false;
      return true;
    } catch (error) {
      logger.error(`Failed to disconnect from NATS: ${error.message}`);
      return false; // Don't throw, just return false
    }
  }

  async publishMessage(topic, message, key = null) {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error("Failed to connect to NATS");
        }
      }

      const payload =
        typeof message === "string" ? message : JSON.stringify(message);

      // Publish message to NATS with timeout
      const publishPromise = this.client.publish(topic, Buffer.from(payload));
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              `NATS publish to ${topic} timed out after ${this.connectionTimeout}ms`
            )
          );
        }, this.connectionTimeout);
      });

      await Promise.race([publishPromise, timeoutPromise]);
      return true;
    } catch (error) {
      logger.error(`Failed to publish message to NATS: ${error.message}`);
      this.isConnected = false;
      throw error;
    }
  }

  async subscribe(topics, groupId, messageHandler) {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error("Failed to connect to NATS");
        }
      }

      const topicsList = Array.isArray(topics) ? topics : [topics];

      for (const topic of topicsList) {
        // Create a queue subscription if groupId is provided
        // This enables load balancing across consumers in the same group
        const options = groupId ? { queue: groupId } : {};

        // Create subscription with timeout
        const subscribePromise = new Promise((resolve) => {
          const subscription = this.client.subscribe(topic, options);
          this.subscriptions.set(topic, subscription);
          resolve(subscription);
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `NATS subscribe to ${topic} timed out after ${this.connectionTimeout}ms`
              )
            );
          }, this.connectionTimeout);
        });

        const subscription = await Promise.race([
          subscribePromise,
          timeoutPromise,
        ]);

        // Process incoming messages
        (async () => {
          for await (const msg of subscription) {
            try {
              const message = msg.data.toString();
              await messageHandler(topic, message);
            } catch (error) {
              logger.error(`Error processing NATS message: ${error.message}`);
            }
          }
        })().catch((error) => {
          logger.error(`NATS subscription error: ${error.message}`);
        });
      }

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to NATS topics: ${error.message}`);
      this.isConnected = false;
      return false; // Don't throw, just return false
    }
  }

  isHealthy() {
    return this.isConnected && this.client !== null;
  }
}

module.exports = NatsBroker;
