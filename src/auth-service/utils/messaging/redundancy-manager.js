// src/utils/messaging/redundancy-manager.js
const {
  MessageBrokerFactory,
  getBrokerPriorities,
} = require("./broker-factory");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- redundancy-manager`
);

class MessageBrokerRedundancyManager {
  constructor(config = {}) {
    this.brokerPriorities = config.brokerPriorities || getBrokerPriorities();
    this.brokers = {};
    this.activeBroker = null;
    this.activeBrokerType = null;
    this.healthCheckInterval = null;
    this.healthCheckIntervalMs = config.healthCheckIntervalMs || 30000; // 30 seconds
    this.initialized = false;
    this.config = config;
  }

  async initialize() {
    try {
      // Initialize all broker instances but don't connect yet
      for (const brokerType of this.brokerPriorities) {
        this.brokers[brokerType] = MessageBrokerFactory.getBroker(
          brokerType,
          this.config[brokerType] || {}
        );
      }

      this.initialized = true;

      // Connect to highest priority broker
      await this.connectToHighestPriorityBroker();

      // Start health check
      this.startHealthCheck();

      return true;
    } catch (error) {
      logger.error(
        `Failed to initialize broker redundancy manager: ${error.message}`
      );
      throw error;
    }
  }

  async connectToHighestPriorityBroker() {
    for (const brokerType of this.brokerPriorities) {
      try {
        const broker = this.brokers[brokerType];

        // Skip if this broker is the current active one
        if (this.activeBroker === broker) {
          return true;
        }

        // Try to connect
        logger.info(`Attempting to connect to ${brokerType} broker...`);
        await broker.connect();

        // If we get here, connection was successful
        this.activeBroker = broker;
        this.activeBrokerType = brokerType;

        logger.info(`Successfully connected to ${brokerType} broker.`);
        return true;
      } catch (error) {
        logger.error(
          `Failed to connect to ${brokerType} broker: ${error.message}`
        );
        // Continue to next broker in priority
      }
    }

    // If we get here, all brokers failed
    this.activeBroker = null;
    this.activeBrokerType = null;
    logger.error("All message brokers failed to connect!");
    return false;
  }

  startHealthCheck() {
    // Clear any existing interval
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Start new health check interval
    this.healthCheckInterval = setInterval(async () => {
      try {
        // Check if active broker is healthy
        if (this.activeBroker && !this.activeBroker.isHealthy()) {
          logger.warn(
            `Active broker ${this.activeBrokerType} is unhealthy. Attempting to reconnect...`
          );
          await this.connectToHighestPriorityBroker();
        }
      } catch (error) {
        logger.error(`Health check error: ${error.message}`);
      }
    }, this.healthCheckIntervalMs);
  }

  async stop() {
    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Disconnect all brokers
    for (const brokerType in this.brokers) {
      try {
        await this.brokers[brokerType].disconnect();
      } catch (error) {
        logger.error(
          `Error disconnecting ${brokerType} broker: ${error.message}`
        );
      }
    }

    this.activeBroker = null;
    this.activeBrokerType = null;
  }

  getActiveBrokerType() {
    return this.activeBrokerType;
  }

  async publishMessage(topic, message, messageId = null) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.activeBroker) {
      const connected = await this.connectToHighestPriorityBroker();
      if (!connected) {
        throw new Error("No message brokers available");
      }
    }

    try {
      // Try with active broker
      await this.activeBroker.publishMessage(topic, message, messageId);
      return {
        success: true,
        broker: this.activeBrokerType,
      };
    } catch (error) {
      logger.error(
        `Failed to publish with ${this.activeBrokerType}: ${error.message}. Trying fallback brokers...`
      );

      // Try with each broker in priority order
      for (const brokerType of this.brokerPriorities) {
        // Skip the broker that just failed
        if (brokerType === this.activeBrokerType) continue;

        try {
          const broker = this.brokers[brokerType];
          await broker.connect();
          await broker.publishMessage(topic, message, messageId);

          // Update active broker
          this.activeBroker = broker;
          this.activeBrokerType = brokerType;

          logger.info(`Successfully failed over to ${brokerType} broker`);
          return {
            success: true,
            broker: brokerType,
          };
        } catch (brokerError) {
          logger.error(
            `Failed to publish with ${brokerType}: ${brokerError.message}`
          );
          // Continue to next broker
        }
      }

      // If we get here, all brokers failed
      throw new Error("All message brokers failed to publish message");
    }
  }

  async subscribe(topics, groupId, messageHandler) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.activeBroker) {
      const connected = await this.connectToHighestPriorityBroker();
      if (!connected) {
        throw new Error("No message brokers available");
      }
    }

    // Create a wrapper for the message handler that includes retries
    const wrappedHandler = async (topic, message) => {
      try {
        await messageHandler(topic, message);
      } catch (error) {
        logger.error(
          `Error in message handler: ${error.message}. Will retry processing.`
        );
        // Implement retry logic here if needed
        try {
          // Wait and retry once
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await messageHandler(topic, message);
        } catch (retryError) {
          logger.error(`Retry failed: ${retryError.message}`);
        }
      }
    };

    // Subscribe to all brokers to ensure maximum reliability
    // This is important because if one broker goes down after messages were published to it,
    // we need to be able to receive those messages when it comes back
    const subscriptionResults = [];

    for (const brokerType of this.brokerPriorities) {
      try {
        const broker = this.brokers[brokerType];
        await broker.connect();
        await broker.subscribe(topics, groupId, wrappedHandler);

        subscriptionResults.push({
          success: true,
          broker: brokerType,
        });

        logger.info(`Successfully subscribed to topics on ${brokerType}`);
      } catch (error) {
        logger.error(
          `Failed to subscribe with ${brokerType}: ${error.message}`
        );
        subscriptionResults.push({
          success: false,
          broker: brokerType,
          error: error.message,
        });
      }
    }

    // Check if at least one subscription was successful
    const anySuccessful = subscriptionResults.some((result) => result.success);
    if (!anySuccessful) {
      throw new Error("Failed to subscribe with any message broker");
    }

    return {
      success: true,
      results: subscriptionResults,
    };
  }
}

module.exports = MessageBrokerRedundancyManager;
