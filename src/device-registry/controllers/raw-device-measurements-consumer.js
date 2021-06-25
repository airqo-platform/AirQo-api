const { logObject, logElement } = require("../utils/log");
const { Kafka } = require('kafkajs')
const { SchemaRegistry } = require('@kafkajs/confluent-schema-registry')

const insertMeasurtements = require("../utils/insert-device-measurements");
const constants = require("../config/constants");
const SCHEMA_REGISTRY = constants.SCHEMA_REGISTRY;
const BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;
const RAW_MEASUREMENTS_TOPIC = constants.KAFKA_RAW_MEASUREMENTS_TOPIC;


const kafka = new Kafka({ clientId: 'device-registry-streams-12723', brokers: [BOOTSTRAP_SERVERS] })
const registry = new SchemaRegistry({ host: SCHEMA_REGISTRY })
const consumer = kafka.consumer({ groupId: 'device-registry-streams-group-12723' })

const rawMeasurementsConsumer = async () => {
  await consumer.connect()
  await consumer.subscribe({ topic: RAW_MEASUREMENTS_TOPIC, fromBeginning: true })

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
        const decodedValue = await registry.decode(message.value)
        const measurements = decodedValue.measurements
        insertMeasurtements.addValuesArray(measurements);
     
    },
  })
}

rawMeasurementsConsumer().catch(console.error)

module.exports = rawMeasurementsConsumer;
