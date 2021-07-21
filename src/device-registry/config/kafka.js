const kafka = require('kafka-node');
//more: https://www.npmjs.com/package/kafka-node#consumer
//more: https://medium.com/@theotow/event-sourcing-with-kafka-and-nodejs-9787a8e47716
const { logObject, logElement, logText } = require("../utils/log");

const constants = require("./constants");
const KAFKA_BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;

logElement("Kafka Bootstrap Servers", KAFKA_BOOTSTRAP_SERVERS);


const kafkaClient = new kafka.KafkaClient({
    kafkaHost: KAFKA_BOOTSTRAP_SERVERS,
    sessionTimeout: 300,
    spinDelay: 100,
    retries: 2
});

kafkaClient.on('error', function (error) {
    console.error(error);
});

module.exports = kafkaClient;



