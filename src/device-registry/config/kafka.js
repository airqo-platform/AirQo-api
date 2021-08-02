const kafka = require('kafka-node');
//more: https://www.npmjs.com/package/kafka-node#consumer
//more: https://medium.com/@theotow/event-sourcing-with-kafka-and-nodejs-9787a8e47716
// more: https://www.npmjs.com/package/avro-schema-registry

const { logElement } = require("../utils/log");
const { Kafka } = require('kafkajs')
const { SchemaRegistry } = require('@kafkajs/confluent-schema-registry')


const constants = require("./constants");
const BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;
const SCHEMA_REGISTRY = constants.SCHEMA_REGISTRY;
const KAFKA_CLIENT_GROUP = constants.KAFKA_CLIENT_GROUP;
const KAFKA_CLIENT_ID = constants.KAFKA_CLIENT_ID;
const KAFKA_USERNAME = constants.KAFKA_USERNAME;
const KAFKA_PASSWORD = constants.KAFKA_PASSWORD;
const SASL = KAFKA_USERNAME && KAFKA_PASSWORD ? { KAFKA_USERNAME, KAFKA_PASSWORD, mechanism: 'plain' } : null
const SSL = !!SASL

logElement("Kafka Bootstrap Servers", BOOTSTRAP_SERVERS);
logElement("Schema Registry", SCHEMA_REGISTRY);
logElement("Group Id", KAFKA_CLIENT_GROUP);
logElement("Client Id", KAFKA_CLIENT_ID);


const kafkaClient = new Kafka({ 
    clientId: KAFKA_CLIENT_ID, 
    brokers: [BOOTSTRAP_SERVERS],
    sasl: SASL,
    ssl: SSL
 });

const schemaRegistry = new SchemaRegistry({ host: SCHEMA_REGISTRY });

const consumerOptions = {
    autoCommit: false,
    groupId: KAFKA_CLIENT_GROUP,
  };

const kafkaClientV2 = new kafka.KafkaClient({
    kafkaHost: BOOTSTRAP_SERVERS,
    sessionTimeout: 300,
    spinDelay: 100,
    retries: 2
});
kafkaClientV2.on('error', function (error) {
    console.error(error);
});
const schemaRegistryV2 = require('avro-schema-registry')(SCHEMA_REGISTRY);

module.exports = { 
    kafkaClient, 
    schemaRegistry, 
    consumerOptions,
    kafkaClientV2, 
    schemaRegistryV2 };



