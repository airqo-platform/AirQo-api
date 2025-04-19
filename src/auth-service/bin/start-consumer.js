// bin/start-consumer.js
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- message-consumer-init`
);
const messageConsumer = require("./jobs/message-consumer");

/**
 * Start the message consumer with error handling
 */
const startConsumer = async () => {
  try {
    logger.info("Starting message consumer service...");

    const result = await messageConsumer();

    if (result.success) {
      logger.info(
        `Message consumer service started successfully using ${result.activeBroker} broker`
      );
    } else {
      logger.error(`Failed to start message consumer: ${result.message}`);
    }
  } catch (error) {
    logger.error(
      `Unexpected error starting message consumer: ${error.message}`
    );

    // Attempt to restart after delay
    setTimeout(() => {
      logger.info("Attempting to restart message consumer...");
      startConsumer().catch((e) => {
        logger.fatal(
          `Critical failure in message consumer restart: ${e.message}`
        );
      });
    }, 30000);
  }
};

// Start the consumer if this file is run directly
if (require.main === module) {
  startConsumer().catch((error) => {
    logger.fatal(`Fatal error in message consumer: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { startConsumer };
