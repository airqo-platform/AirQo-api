require("module-alias/register");
// loadEnvironment() replaces dotenv.config(). It loads the environment-specific
// file first (.env.{NODE_ENV}.json for Azure Key Vault, then .env.{NODE_ENV}
// flat format), falling back to the base .env. It also keeps both file formats
// in sync at startup so that Azure KV JSON and legacy flat files never diverge.
const { loadEnvironment } = require("../config/env-loader");
loadEnvironment();
require("app-module-path").addPath(__dirname);
const kafkaConsumer = require("./jobs/kafka-consumer");
const createServer = require("./server");
const log4js = require("log4js");
const constants = require("@config/constants");
const log4jsConfiguration = require("@config/log4js");
log4js.configure(log4jsConfiguration);
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- bin/index`);
const { stringify } = require("@utils/common");
const {
  logObject,
  EnvironmentDetector,
  isDevelopment,
  isProduction,
  isStaging,
  getEnvironment,
  getDetailedInfo,
  resetCache,
} = require("@utils/shared");

try {
  require("fs").mkdirSync("./log");
} catch (e) {
  if (e.code != "EEXIST") {
    console.error("Could not set up log directory, error was: ", e);
    process.exit(1);
  }
}

const startKafka = async () => {
  await kafkaConsumer().catch((error) => {
    logObject("KAFKA error in the main()", error);
    logger.error(
      `🐛🐛 KAFKA: internal server error in the main() -- ${stringify(error)}`
    );
    logger.error(
      `🐛🐛 KAFKA error message: internal server error in the main() -- ${error.message}`
    );
  });
};

const main = async () => {
  try {
    if (!isDevelopment()) {
      console.log("🚀 Starting Kafka consumer...");
      await startKafka();
      console.log("✅ Kafka consumer started");
    } else {
      console.log("🚫 Skipping Kafka in development mode");
    }
    const server = createServer();
    global.server = server;
  } catch (error) {
    logger.error(`🐛🐛 error in the main() -- ${stringify(error)}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("🐛🐛 Error starting the application: ", error);
  logger.error(`🐛🐛 Error starting the application -- ${stringify(error)}`);
});
