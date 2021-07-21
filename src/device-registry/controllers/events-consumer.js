const { logObject, logElement } = require("../utils/log");

// const { Kafka } = require('kafkajs')
// const { SchemaRegistry } = require('@kafkajs/confluent-schema-registry')

const kafka = require('kafka-node');
const kafkaClient = require('../config/kafka');

const { transformMeasurements_v2 } = require("../utils/transform-measurements");
const { bulkInsert } = require("../utils/insert-measurements");
const { filterMeasurementsWithExistingDevices } = require("../utils/does-component-exist");

const constants = require("../config/constants");
const SCHEMA_REGISTRY = constants.SCHEMA_REGISTRY;
const BOOTSTRAP_SERVERS = constants.KAFKA_BOOTSTRAP_SERVERS;
const RAW_MEASUREMENTS_TOPICS = constants.KAFKA_RAW_MEASUREMENTS_TOPICS;
const KAFKA_CLIENT_ID = constants.KAFKA_CLIENT_ID;
const KAFKA_CLIENT_GROUP = constants.KAFKA_CLIENT_GROUP;

const rawEventsConsumer = async () => {


  const kafka = new Kafka({ clientId: KAFKA_CLIENT_ID, brokers: [BOOTSTRAP_SERVERS] })
  const registry = new SchemaRegistry({ host: SCHEMA_REGISTRY })
  const consumer = kafka.consumer({ groupId: KAFKA_CLIENT_GROUP })

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

        const valid_measurements = await filterMeasurementsWithExistingDevices(measurements);
        const transformedMeasurements = await transformMeasurements_v2(valid_measurements);
        const response = await bulkInsert(transformedMeasurements);

        logObject("Kafka Data insertion log", JSON.stringify(response));

      }
      catch (e) {
        logObject("Kafka Raw Measurements consumer", e);
      }
    },
  });
}

// rawEventsConsumer().catch(console.error)


const kafkaNodeConsumer = () => {

  const Consumer = kafka.Consumer;

  const topics = RAW_MEASUREMENTS_TOPICS.split(",");
  const consumerTopics = [];

  for (const topic of topics) {
    consumerTopics.push({topic: topic});
    break;
    // await consumer.subscribe({ topic: topic.trim().toLowerCase(), fromBeginning: true });
  }


  const consumerOptions = {
    autoCommit: false,
    groupId: KAFKA_CLIENT_GROUP,
  };
  
  let kafkaConsumer = new Consumer(kafkaClient, consumerTopics, consumerOptions);
  kafkaConsumer.on('message', function (message) {
  
      try {
  
          logObject("Kafka Message Received", message);
  
      } catch (error) {
          logElement("Error Occurred in kafka kcca consumer", error);
      }
  
  });
  kafkaConsumer.on('error', function (err) {
      console.log('error', err);
  });
  
  process.on('SIGINT', function () {
    kafkaConsumer.close(true, function () {
          process.exit();
      })
  });
};


module.exports = { rawEventsConsumer, kafkaNodeConsumer };
