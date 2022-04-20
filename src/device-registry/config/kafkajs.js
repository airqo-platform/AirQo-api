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
  logText("connecting to kafka producer...");
  try {
    await kafkaProducer.connect();
  } catch (error) {
    logElement("KAFKA PRODUCER CONNECTION ERROR", error.message);
  }
};

const runKafkaConsumer = async () => {
  logText("connecting to kafka consumer...");
  try {
    await kafkaConsumer.connect();
  } catch (error) {
    logElement("KAFKA CONSUMER CONNECTION ERROR", error.message);
  }
};

module.exports = {
  kafkaConsumer,
  kafkaProducer,
  runKafkaProducer,
  runKafkaConsumer,
};
