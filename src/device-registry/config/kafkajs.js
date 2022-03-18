const { Kafka } = require("kafkajs");
const constants = require("../config/constants");
const { logText, logObject, logElement } = require("../utils/log");

const kafka = new Kafka({
  clientId: "device-registry-kafkajs",
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const kafkaConsumer = kafka.consumer({
  groupId: constants.UNIQUE_CONSUMER_GROUP,
});

const kafkaProducer = kafka.producer({
  groupId: constants.UNIQUE_PRODUCER_GROUP,
});

const runKafkaProducer = async () => {
  logText("connecting to kafka consumer");
  await kafkaProducer.connect();
};

const runKafkaConsumer = async () => {
  logText("connecting to kafka consumer");
  await kafkaConsumer.connect();
};

module.exports = {
  kafkaConsumer,
  kafkaProducer,
  runKafkaProducer,
  runKafkaConsumer,
};
