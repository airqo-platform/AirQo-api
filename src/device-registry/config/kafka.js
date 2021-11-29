const kafka = require("kafka-node");
const { logObject, logElement, logText } = require("../utils/log");

const constants = require("./constants");
const KAFKA_BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;

logElement("Kafka Bootstrap Servers", KAFKA_BOOTSTRAP_SERVERS);

const Producer = kafka.Producer;
const client = new kafka.KafkaClient({
  kafkaHost: KAFKA_BOOTSTRAP_SERVERS,
  sessionTimeout: 300,
  spinDelay: 100,
  retries: 2,
});
const producer = new Producer(client);

const sendMessagesToTopics = (payloads) => {
  producer.on("ready", () => {
    producer.send(payloads, (err, data) => {
      logObject("Kafka producer data", data);
      logObject("Kafka producer error", err);
    });
  });

  producer.on("event", (err) => {
    logObject("kafka producer error", err);
  });
};

client.on("error", function(error) {
  logObject("Kafka connection error", error);
});

module.exports = { client, sendMessagesToTopics };
