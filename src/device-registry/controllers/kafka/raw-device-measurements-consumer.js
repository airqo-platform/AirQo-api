const { logObject, logElement } = require("../../utils/log");
// const client = require('../../config/kafka');

// var avro = require('avsc');
// const insertMeasurtements = require("../../utils/insert-device-measurements");
const constants = require("../../config/constants");
const SCHEMA_REGISTRY = constants.SCHEMA_REGISTRY;
const KAFKA_BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;

const { Kafka } = require('kafkajs')
const { SchemaRegistry } = require('@kafkajs/confluent-schema-registry')

const kafka = new Kafka({ clientId: 'device-registry-streams', brokers: [KAFKA_BOOTSTRAP_SERVERS] })
const registry = new SchemaRegistry({ host: SCHEMA_REGISTRY })
const consumer = kafka.consumer({ groupId: 'device-registry-streams-group' })

const rawMeasurementsConsumer = async () => {
  await consumer.connect()
  await consumer.subscribe({ topic: 'transformed-device-measurements-topic', fromBeginning: true })

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const decodedValue = await registry.decode(message.value)
      logObject("Measurements", decodedValue)
    //   console.log({ decodedValue })
    },
  })
}

rawMeasurementsConsumer().catch(console.error)

module.exports = rawMeasurementsConsumer;
