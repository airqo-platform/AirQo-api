const kafka = require("kafka-node");
const { logObject, logElement, logText } = require("../utils/log");
const constants = require("./constants");
const { KAFKA_BOOTSTRAP_SERVERS } = constants;
const log4js = require("log4js");
const logger = log4js.getLogger("kafka-config");

logElement("Kafka Bootstrap Servers", KAFKA_BOOTSTRAP_SERVERS);

try {
  const kafkaClient = new kafka.KafkaClient({
    kafkaHost: KAFKA_BOOTSTRAP_SERVERS,
    sessionTimeout: 300,
    spinDelay: 100,
    retries: 2,
    commitOffsetsOnFirstJoin: true,
  });

  kafkaClient.on("error", function(error) {
    logObject("Kafka connection error", error);
    logger.error(`kafka connection error -- ${error}`);
  });

  const Producer = kafka.Producer;
  const kafkaProducer = new Producer(kafkaClient);
  kafkaProducer.on("ready", () => {
    logger.info(`kafka producer ready to push topic`);
  });
  kafkaProducer.on("event", (err) => {
    logObject("kafka producer error", err);
    logger.error(`kafka producer error -- ${err}`);
  });

  const Consumer = kafka.Consumer;
  const kafkaConsumer = new Consumer(kafkaClient);
  kafkaConsumer.on("message", function(message) {
    logger.info(`the incoming Kafka message`, message);
    console.log(message);
  });
  kafkaConsumer.on("error", function(error) {
    logObject("kafka consumer error", error);
    logger.error(`kafka consumer error -- ${error}`);
  });

  module.exports = { kafka, kafkaClient, kafkaProducer, kafkaConsumer };
} catch (error) {
  logObject("the error on Kafka connection", error.message);
  logger.error(`kafka config exception, ${error}`);
}
