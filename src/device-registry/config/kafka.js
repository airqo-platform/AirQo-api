const kafka = require('kafka-node');
//more: https://www.npmjs.com/package/kafka-node#consumer
//more: https://medium.com/@theotow/event-sourcing-with-kafka-and-nodejs-9787a8e47716
// more: https://www.npmjs.com/package/avro-schema-registry

const { logObject, logElement, logText } = require("../utils/log");
const { Kafka } = require('kafkajs')
const { SchemaRegistry } = require('@kafkajs/confluent-schema-registry')


const constants = require("./constants");
const KAFKA_BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;
const SCHEMA_REGISTRY = constants.SCHEMA_REGISTRY;

logElement("Kafka Bootstrap Servers", KAFKA_BOOTSTRAP_SERVERS);


const kafkaClient = new Kafka({ clientId: KAFKA_CLIENT_ID, brokers: [BOOTSTRAP_SERVERS] })
const schemaRegistry = new SchemaRegistry({ host: SCHEMA_REGISTRY })

const kafkaClientV2 = new kafka.KafkaClient({
    kafkaHost: KAFKA_BOOTSTRAP_SERVERS,
    sessionTimeout: 300,
    spinDelay: 100,
    retries: 2
});

const kafkaClientV2 = new kafka.KafkaClient({
    kafkaHost: KAFKA_BOOTSTRAP_SERVERS,
});

kafkaClientV2.on('error', function (error) {
    console.error(error);
});
const schemaRegistryV2 = require('avro-schema-registry')(SCHEMA_REGISTRY);

module.exports = { kafkaClient, kafkaClientV2, schemaRegistry, schemaRegistryV2 };



