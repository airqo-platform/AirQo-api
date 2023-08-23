require("module-alias/register");
const dotenv = require("dotenv");
dotenv.config();
require("app-module-path").addPath(__dirname);
const kafkaConsumer = require("./kafka-consumer");
const createServer = require("./server");
const log4js = require("log4js");
const constants = require("@config/constants");

const log4jsConfiguration = require("@config/log4js");
log4js.configure(log4jsConfiguration);
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- bin/index script`);

try {
  require("fs").mkdirSync("./log");
} catch (e) {
  if (e.code != "EEXIST") {
    console.error("Could not set up log directory, error was: ", e);
    process.exit(1);
  }
}

const main = async () => {
  try {
    await kafkaConsumer().catch((error) => {
      logObject("KAFKA error in the main()", error);
      logger.error(
        `KAFKA: internal server error in the main() -- ${JSON.stringify(error)}`
      );
      logger.error(
        `KAFKA error message: internal server error in the main() -- ${error.message}`
      );
    });
    createServer();
  } catch (error) {
    logger.error(`error in the main() -- ${JSON.stringify(error)}`);
  }
};

main().catch((error) => {
  console.error("Error starting the application: ", error);
  logger.error(`Error starting the application -- ${JSON.stringify(error)}`);
});
