// src/utils/messaging/messaging-service.js
const MessageBrokerRedundancyManager = require("./redundancy-manager");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- messaging-service`
);
const { v4: uuidv4 } = require("uuid");

class MessagingService {
  constructor(config = {}) {
    this.redundancyManager = new MessageBrokerRedundancyManager(config);
    this.initialized = false;
    this.topicHandlers = new Map();
  }

  async initialize() {
    if (!this.initialized) {
      try {
        // Check if message consumer is explicitly disabled
        if (process.env.ENABLE_MESSAGE_CONSUMER === "false") {
          logger.info(
            "Messaging service initialization skipped (disabled by configuration)"
          );
          this.initialized = true;
          return true;
        }

        const result = await this.redundancyManager
          .initialize()
          .catch((error) => {
            logger.warn(
              `Error initializing redundancy manager: ${error.message}`
            );
            return false;
          });

        this.initialized = true;

        if (result) {
          logger.info("Messaging service initialized successfully");
        } else {
          logger.warn("Messaging service initialized with no active brokers");
        }

        return true;
      } catch (error) {
        logger.error(
          `Failed to initialize messaging service: ${error.message}`
        );
        this.initialized = true; // Still mark as initialized to prevent repeated attempts
        return false;
      }
    }
    return true;
  }

  async publish(topic, message, options = {}) {
    if (!this.initialized) {
      await this.initialize().catch((error) => {
        logger.warn(`Failed to initialize messaging service: ${error.message}`);
      });
    }

    // Generate a message ID for tracking if not provided
    const messageId = options.messageId || uuidv4();

    try {
      // If no active broker, try connecting again
      if (!this.redundancyManager.getActiveBrokerType()) {
        await this.redundancyManager
          .connectToHighestPriorityBroker()
          .catch(() => {});
      }

      // If still no active broker, store message for later and return
      if (!this.redundancyManager.getActiveBrokerType()) {
        logger.warn(
          `No active broker available, message to ${topic} queued for later delivery`
        );
        // You could implement a local message queue here if needed
        return {
          success: false,
          messageId,
          queued: true,
          error: "No active broker available",
        };
      }

      const result = await this.redundancyManager.publishMessage(
        topic,
        message,
        messageId
      );
      logger.info(`Message published to ${topic} via ${result.broker} broker`);
      return {
        success: true,
        messageId,
        broker: result.broker,
      };
    } catch (error) {
      logger.error(`Failed to publish message to ${topic}: ${error.message}`);
      return {
        success: false,
        messageId,
        error: error.message,
      };
    }
  }

  async subscribe(topics, handlerFn, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const groupId = options.groupId || constants.UNIQUE_CONSUMER_GROUP;

    try {
      // Store the handler for this topic
      const topicsList = Array.isArray(topics) ? topics : [topics];
      for (const topic of topicsList) {
        this.topicHandlers.set(topic, handlerFn);
      }

      // Subscribe using the redundancy manager
      const result = await this.redundancyManager.subscribe(
        topics,
        groupId,
        async (topic, message) => {
          try {
            // Parse message if it's JSON
            let parsedMessage;
            try {
              parsedMessage = JSON.parse(message);
            } catch {
              parsedMessage = message;
            }

            // Execute the handler
            await handlerFn(topic, parsedMessage);
          } catch (error) {
            logger.error(
              `Error processing message from ${topic}: ${error.message}`
            );
          }
        }
      );

      return result;
    } catch (error) {
      logger.error(`Failed to subscribe to topics: ${error.message}`);
      throw error;
    }
  }

  getActiveBrokerType() {
    return this.redundancyManager.getActiveBrokerType();
  }

  async shutdown() {
    await this.redundancyManager.stop();
    this.initialized = false;
  }
}

// Export as a singleton
let instance = null;

module.exports = {
  getInstance: (config) => {
    if (!instance) {
      instance = new MessagingService(config);
    }
    return instance;
  },
};
