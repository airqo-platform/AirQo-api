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
  }

  getName() {
    return "nats";
  }

  async connect() {
    try {
      const options = {
        servers: this.config.servers ||
          constants.NATS_SERVERS || ["nats://localhost:4222"],
        timeout: this.config.timeout || 5000,
        pingInterval: this.config.pingInterval || 10000,
        reconnect: true,
        maxReconnectAttempts: this.config.maxReconnectAttempts || 10,
        reconnectTimeWait: this.reconnectDelay,
      };

      this.client = await connect(options);

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
      throw error;
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
      throw error;
    }
  }

  async publishMessage(topic, message, key = null) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const payload =
        typeof message === "string" ? message : JSON.stringify(message);

      // Publish message to NATS
      await this.client.publish(topic, Buffer.from(payload));
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
        await this.connect();
      }

      const topicsList = Array.isArray(topics) ? topics : [topics];

      for (const topic of topicsList) {
        // Create a queue subscription if groupId is provided
        // This enables load balancing across consumers in the same group
        const options = groupId ? { queue: groupId } : {};

        const subscription = this.client.subscribe(topic, options);

        this.subscriptions.set(topic, subscription);

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
      throw error;
    }
  }

  isHealthy() {
    return this.isConnected && this.client !== null;
  }
}

module.exports = NatsBroker;
