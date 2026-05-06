require("module-alias/register");
require("../config/env-loader").loadEnvironment();
require("app-module-path").addPath(__dirname);
const kafkaConsumer = require("@bin/jobs/kafka-consumer");
let createServer;
try {
  createServer = require("./server");
} catch (err) {
  console.error("🔥 Failed to load server module:", err.stack || err.message);
  process.exit(1);
}
const log4js = require("log4js");
const constants = require("@config/constants");
const log4jsConfiguration = require("@config/log4js");
log4js.configure(log4jsConfiguration);
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- bin/index script`);
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

    // Subscription background jobs — production only.
    // Each job has an internal isPaddleConfigured guard so it stays dormant
    // until valid Paddle credentials are supplied, giving a second kill switch
    // for phased rollout on the existing user base.
    if (isProduction()) {
      require("@bin/jobs/check-subscription-status");
      require("@bin/jobs/subscription-renewal-job");
      logger.info("✅ Subscription background jobs registered");
    }

    createServer();
  } catch (error) {
    console.error(`🐛🐛 error in the main() -- ${error.stack || error.message}`);
    logger.error(`🐛🐛 error in the main() -- ${stringify(error)}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("🐛🐛 Error starting the application: ", error);
  logger.error(`🐛🐛 Error starting the application -- ${stringify(error)}`);
  process.exit(1);
});
