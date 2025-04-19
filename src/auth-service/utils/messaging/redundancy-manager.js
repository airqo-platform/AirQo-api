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
    this.healthCheckIntervalMs =
      config.healthCheckIntervalMs ||
      constants.MESSAGE_BROKER_HEALTH_CHECK_INTERVAL ||
      30000; // 30 seconds
    this.initialized = false;
    this.config = config;
    this.connectionTimeout =
      constants.MESSAGE_BROKER_CONNECTION_TIMEOUT_MS || 5000;
    this.initialConnectionDelayMs =
      config.initialConnectionDelayMs ||
      constants.MESSAGE_BROKER_INITIAL_DELAY_MS ||
      0;
    this.allowNoConnection =
      config.allowNoConnection ||
      constants.MESSAGE_BROKER_ALLOW_NO_CONNECTION === "true";
  }

  async initialize() {
    try {
      logger.info("Initializing message broker redundancy manager...");

      // Skip initialization if message consumer is explicitly disabled
      if (process.env.DEV_ENABLE_MESSAGE_CONSUMER === "false") {
        logger.info(
          "Message broker initialization skipped (disabled by environment variable)"
        );
        this.initialized = true;
        return true;
      }

      // Initialize all broker instances but don't connect yet
      for (const brokerType of this.brokerPriorities) {
        try {
          this.brokers[brokerType] = MessageBrokerFactory.getBroker(
            brokerType,
            this.config[brokerType] || {}
          );
          logger.info(`Initialized ${brokerType} broker instance`);
        } catch (error) {
          logger.error(
            `Failed to initialize ${brokerType} broker: ${error.message}`
          );
        }
      }

      this.initialized = true;

      // If delay is configured, wait before connecting
      if (this.initialConnectionDelayMs > 0) {
        logger.info(
          `Waiting ${this.initialConnectionDelayMs}ms before connecting to brokers...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, this.initialConnectionDelayMs)
        );
      }

      // Connect to highest priority broker
      try {
        const connected = await this.connectToHighestPriorityBroker();

        if (connected) {
          logger.info(
            `Successfully connected to ${this.activeBrokerType} broker`
          );
        } else if (this.allowNoConnection) {
          logger.warn(
            "No message brokers available, but continuing due to allowNoConnection setting"
          );
        } else {
          logger.warn(
            "No message brokers available. Messages may be queued until a broker becomes available."
          );
        }
      } catch (error) {
        if (this.allowNoConnection) {
          logger.warn(
            `Failed to connect to any broker, but continuing: ${error.message}`
          );
        } else {
          logger.error(
            `Failed to connect to any message broker: ${error.message}`
          );
          if (!this.initialized) {
            throw error; // Only throw if we haven't initialized
          }
        }
      }

      // Start health check
      this.startHealthCheck();

      return true;
    } catch (error) {
      logger.error(
        `Failed to initialize broker redundancy manager: ${error.message}`
      );
      // Still mark as initialized to prevent repeated attempts
      this.initialized = true;

      if (this.allowNoConnection) {
        return false;
      } else {
        throw error;
      }
    }
  }

  async connectToHighestPriorityBroker() {
    // Skip connection attempt if explicitly disabled
    if (process.env.DEV_ENABLE_MESSAGE_CONSUMER === "false") {
      logger.info(
        "Message consumer disabled. Skipping broker connection attempts."
      );
      return false;
    }

    let lastError = null;

    for (const brokerType of this.brokerPriorities) {
      try {
        if (!this.brokers[brokerType]) {
          logger.warn(
            `Broker ${brokerType} is not initialized, skipping connection attempt`
          );
          continue;
        }

        const broker = this.brokers[brokerType];

        // Skip if this broker is the current active one
        if (this.activeBroker === broker && broker.isHealthy()) {
          logger.info(`Using existing connection to ${brokerType} broker`);
          return true;
        }

        // Try to connect with timeout
        logger.info(`Attempting to connect to ${brokerType} broker...`);

        const connectPromise = broker.connect();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  `Connection attempt to ${brokerType} timed out after ${this.connectionTimeout}ms`
                )
              ),
            this.connectionTimeout
          )
        );

        const connected = await Promise.race([
          connectPromise,
          timeoutPromise,
        ]).catch((error) => {
          logger.error(`Error connecting to ${brokerType}: ${error.message}`);
          return false;
        });

        if (connected) {
          // If we get here, connection was successful
          this.activeBroker = broker;
          this.activeBrokerType = brokerType;

          logger.info(`Successfully connected to ${brokerType} broker.`);
          return true;
        } else {
          logger.warn(
            `Failed to connect to ${brokerType} broker, trying next option`
          );
        }
      } catch (error) {
        lastError = error;
        logger.error(
          `Failed to connect to ${brokerType} broker: ${error.message}`
        );
        // Continue to next broker in priority
      }
    }

    // If we get here, all brokers failed
    this.activeBroker = null;
    this.activeBrokerType = null;

    const errorMessage = "All message brokers failed to connect";
    logger.warn(
      `${errorMessage}. Messages will be queued until a broker becomes available.`
    );

    if (this.allowNoConnection) {
      return false;
    } else if (lastError) {
      throw lastError;
    } else {
      throw new Error(errorMessage);
    }
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
          try {
            await this.connectToHighestPriorityBroker();
          } catch (error) {
            logger.error(`Failed to reconnect: ${error.message}`);
          }
        } else if (!this.activeBroker) {
          // No active broker, try to connect
          logger.info("No active broker. Attempting to connect...");
          try {
            await this.connectToHighestPriorityBroker();
          } catch (error) {
            logger.error(`Failed to connect: ${error.message}`);
          }
        }
      } catch (error) {
        logger.error(`Health check error: ${error.message}`);
      }
    }, this.healthCheckIntervalMs);

    // Ensure the interval doesn't prevent the process from exiting
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref();
    }
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
        if (this.brokers[brokerType]) {
          await this.brokers[brokerType].disconnect().catch((error) => {
            logger.error(
              `Error disconnecting ${brokerType} broker: ${error.message}`
            );
          });
        }
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
      try {
        const connected = await this.connectToHighestPriorityBroker();
        if (!connected) {
          if (this.allowNoConnection) {
            logger.warn(
              `No message brokers available, message to ${topic} will be dropped`
            );
            return { success: false, reason: "no_broker_available" };
          } else {
            throw new Error("No message brokers available");
          }
        }
      } catch (error) {
        throw error;
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
          if (!broker) continue;

          const connected = await broker.connect().catch(() => false);
          if (!connected) continue;

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
      const errorMessage = "All message brokers failed to publish message";
      if (this.allowNoConnection) {
        logger.warn(`${errorMessage}, message to ${topic} will be dropped`);
        return { success: false, reason: "all_brokers_failed" };
      } else {
        throw new Error(errorMessage);
      }
    }
  }

  async subscribe(topics, groupId, messageHandler) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.activeBroker) {
      try {
        const connected = await this.connectToHighestPriorityBroker();
        if (!connected && !this.allowNoConnection) {
          throw new Error("No message brokers available");
        }
      } catch (error) {
        if (this.allowNoConnection) {
          logger.warn(`Cannot subscribe to topics: ${error.message}`);
          return { success: false, reason: "no_broker_available" };
        } else {
          throw error;
        }
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
        if (!broker) {
          logger.warn(
            `Broker ${brokerType} is not initialized, skipping subscription`
          );
          continue;
        }

        const connected = await broker.connect().catch(() => false);
        if (!connected) {
          logger.warn(
            `Could not connect to ${brokerType} broker for subscription`
          );
          subscriptionResults.push({
            success: false,
            broker: brokerType,
            error: "Connection failed",
          });
          continue;
        }

        const subscribed = await broker
          .subscribe(topics, groupId, wrappedHandler)
          .catch((error) => {
            logger.error(
              `Failed to subscribe with ${brokerType}: ${error.message}`
            );
            return false;
          });

        if (subscribed) {
          subscriptionResults.push({
            success: true,
            broker: brokerType,
          });

          logger.info(`Successfully subscribed to topics on ${brokerType}`);
        } else {
          subscriptionResults.push({
            success: false,
            broker: brokerType,
            error: "Subscription failed",
          });
        }
      } catch (error) {
        logger.error(
          `Error during subscription to ${brokerType}: ${error.message}`
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
    if (!anySuccessful && !this.allowNoConnection) {
      throw new Error("Failed to subscribe with any message broker");
    }

    return {
      success: anySuccessful || this.allowNoConnection,
      results: subscriptionResults,
    };
  }
}

module.exports = MessageBrokerRedundancyManager;
