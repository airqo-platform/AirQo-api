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
const NetworkModel = require("@models/Network");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/index script`
);
const createScheduledJob = require("./scheduler");
const lowBalanceAlertJob = {
  schedule: "* * * * *", // Schedule expression (e.g., every minute)
  apiEndpoint: "your-api-endpoint",
  getThreshold: async () => {
    try {
      const network = await NetworkModel("airqo").findOne(); // Assuming you retrieve the relevant network document
      if (network && network.internet_data_threshold) {
        return network.internet_data_threshold;
      }
    } catch (error) {
      console.error("Error fetching threshold:", error);
    }
    return 5;
  },
};

try {
  require("fs").mkdirSync("./log");
} catch (e) {
  if (e.code != "EEXIST") {
    console.error("Could not set up log directory, error was: ", e);
    process.exit(1);
  }
}

const main = async () => {
  createServer();
  // await kafkaConsumer().catch((error) => {
  //   logger.error(`KAFKA: internal server error -- ${JSON.stringify(error)}`);
  // });
  // createScheduledJob(lowBalanceAlertJob);
};

main().catch((error) => {
  console.error("Error starting the application: ", error);
});
