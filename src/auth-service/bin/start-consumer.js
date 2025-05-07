// bin/start-consumer.js
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- message-consumer-init`
);
const messageConsumer = require("./jobs/message-consumer");

/**
 * Start the message consumer with error handling and timeout protection
 */
const startConsumer = async () => {
  try {
    logger.info("Starting message consumer service...");

    // Add timeout to ensure consumer initialization doesn't block indefinitely
    const consumerPromise = messageConsumer();
    const timeoutPromise = new Promise((resolve) => {
      const timeoutMs = constants.MESSAGE_CONSUMER_STARTUP_TIMEOUT_MS || 10000; // Default 10 seconds
      setTimeout(() => {
        logger.warn(
          `Message consumer initialization timed out after ${timeoutMs}ms, but continuing application startup`
        );
        resolve({
          success: false,
          message: "Initialization timed out",
          activeBroker: null,
        });
      }, timeoutMs);
    });

    const result = await Promise.race([consumerPromise, timeoutPromise]);

    if (result && result.success) {
      logger.info(
        `Message consumer service started successfully using ${result.activeBroker} broker`
      );
      return result;
    } else {
      logger.warn(
        `Message consumer may not have started properly: ${
          result ? result.message : "Unknown error"
        }`
      );
      return {
        success: false,
        message: result ? result.message : "Unknown error",
        activeBroker: null,
      };
    }
  } catch (error) {
    logger.error(
      `Unexpected error starting message consumer: ${error.message}`
    );
    logger.error(error.stack);

    // Return a structured error result instead of throwing
    return {
      success: false,
      message: error.message,
      error: error,
      activeBroker: null,
    };
  }
};

// Start the consumer if this file is run directly
if (require.main === module) {
  startConsumer()
    .then((result) => {
      if (!result.success) {
        logger.warn(
          `Message consumer startup completed with warnings: ${result.message}`
        );
      }
    })
    .catch((error) => {
      logger.error(`Error in message consumer startup: ${error.message}`);
      // Don't exit process, just log the error
    });
}

module.exports = { startConsumer };
