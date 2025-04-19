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

      // Start the consumer and handle any errors
      await startConsumer().catch((error) => {
        logObject("Message Consumer error in the main()", error);
        logger.error(
          `🐛🐛 Message Consumer: internal server error in the main() -- ${stringify(
            error
          )}`
        );
      });

      logger.info("Message consumer started successfully");
    } else {
      logger.info("Message consumer is disabled by configuration");
    }
  } catch (error) {
    logger.error(`🐛🐛 Error starting message consumer -- ${stringify(error)}`);
  }
};

const main = async () => {
  try {
    // Start the message consumer with redundancy
    await startMessageConsumer();

    // Create and start the HTTP server
    createServer();
  } catch (error) {
    logger.error(`🐛🐛 Error in the main() -- ${stringify(error)}`);
  }
};

main().catch((error) => {
  console.error("Error starting the application: ", error);
  logger.error(`🐛🐛 Error starting the application -- ${stringify(error)}`);
});
