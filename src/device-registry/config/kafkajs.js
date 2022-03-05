const { Kafka } = require("kafkajs");
const constants = require("../config/constants");

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

module.exports = { kafkaConsumer, kafkaProducer };
