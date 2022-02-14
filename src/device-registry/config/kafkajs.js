const { Kafka } = require("kafkajs");
const constants = require("../config/constants");

const kafka = new Kafka({
  clientId: "device-registry-kafkajs",
  brokers: [constants.KAFKA_BOOTSTRAP_SERVERS],
});

module.exports = kafka;
