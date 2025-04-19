require("module-alias/register");
const dotenv = require("dotenv");
dotenv.config();
require("app-module-path").addPath(__dirname);
const { startConsumer } = require("@bin/start-consumer");
const createServer = require("./server");
const log4js = require("log4js");
const constants = require("@config/constants");
const log4jsConfiguration = require("@config/log4js");
log4js.configure(log4jsConfiguration);
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- bin/index script`);
const { stringify } = require("@utils/common");
const { logObject } = require("@utils/shared");

// Add global exception handlers
process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
  // Log but don't exit process
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
  // Log but don't exit process
  logger.error(`Unhandled Promise Rejection: ${reason}`);
});

try {
  require("fs").mkdirSync("./log");
} catch (e) {
  if (e.code != "EEXIST") {
    console.error("Could not set up log directory, error was: ", e);
    process.exit(1);
  }
}

const startMessageConsumer = async () => {
  try {
    // Check if message consumer is enabled in configuration
    if (constants.ENABLE_MESSAGE_CONSUMER !== "false") {
      logger.info("Starting message consumer with redundancy support...");

      // Start the consumer but don't await it - let it run in the background
      // This prevents message consumer initialization from blocking server startup
      startConsumer().catch((error) => {
        logObject("Message Consumer error in the main()", error);
        logger.error(
          `🐛🐛 Message Consumer: internal server error in the main() -- ${stringify(
            error
          )}`
        );
      });

      logger.info("Message consumer started in background");
    } else {
      logger.info("Message consumer is disabled by configuration");
    }
  } catch (error) {
    logger.error(`🐛🐛 Error starting message consumer -- ${stringify(error)}`);
    // Continue execution even if message consumer fails
  }
};

const main = async () => {
  console.log("Starting application...");

  try {
    // Start the message consumer, but don't wait for it to complete
    startMessageConsumer();

    // Create and start the HTTP server immediately
    // This ensures server starts even if message consumer has issues
    const server = createServer();
    logger.info("Server creation initiated");

    return server;
  } catch (error) {
    logObject("Error in the main()", error);
    logger.error(`🐛🐛 Error in the main() -- ${stringify(error)}`);

    // Try to start the server anyway if there was an error
    try {
      logger.info("Attempting to start server despite error...");
      return createServer();
    } catch (serverError) {
      logger.error(
        `Failed to create server as fallback: ${stringify(serverError)}`
      );
      throw serverError; // Re-throw if server creation fails
    }
  }
};

// Add auto-recovery if process exits abnormally
process.on("exit", (code) => {
  if (code !== 0) {
    console.log(`Process exited with code ${code}`);
    // We can't restart from within the exit handler, but we can log it
    logger.error(`Process exited with code ${code}, application needs restart`);
  }
});

main().catch((error) => {
  console.error("Error starting the application: ", error);
  logger.error(
    `🐛🐛 Fatal error starting the application -- ${stringify(error)}`
  );
});
