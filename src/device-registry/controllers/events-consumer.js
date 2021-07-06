const { logObject, logElement } = require("../utils/log");
const { Kafka } = require('kafkajs')
const { SchemaRegistry } = require('@kafkajs/confluent-schema-registry')
const insertMeasurtements = require("../utils/bulk-insert-measurements");
const constants = require("../config/constants");
const SCHEMA_REGISTRY = constants.SCHEMA_REGISTRY;
const BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;
const RAW_MEASUREMENTS_TOPICS = constants.KAFKA_RAW_MEASUREMENTS_TOPICS;
const KAFKA_CLIENT_ID = constants.KAFKA_CLIENT_ID;
const KAFKA_CLIENT_GROUP = constants.KAFKA_CLIENT_GROUP;

const kafka = new Kafka({ clientId: KAFKA_CLIENT_ID, brokers: [BOOTSTRAP_SERVERS] })
const registry = new SchemaRegistry({ host: SCHEMA_REGISTRY })
const consumer = kafka.consumer({ groupId: KAFKA_CLIENT_GROUP })

const rawEventsConsumer = async () => {
  await consumer.connect();

  const topics = RAW_MEASUREMENTS_TOPICS.split(",");

  for (const topic of topics) {
    await consumer.subscribe({ topic: topic.trim().toLowerCase(), fromBeginning: true });
  }
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try{
        const decodedValue = await registry.decode(message.value)
        const measurements = decodedValue.measurements
        insertMeasurtements.addValuesArray(measurements);
      }
      catch (e) {
        logObject("Kafka Raw Measurements consumer", e);
      }
    },
  });
}

rawEventsConsumer().catch(console.error)

module.exports = rawEventsConsumer;
