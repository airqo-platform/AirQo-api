const { logObject, logElement } = require("../utils/log");

const { kafkaClient, kafkaClientV2, schemaRegistry, schemaRegistryV2 } = require('../config/kafka');

const { transformMeasurements_v2 } = require("../utils/transform-measurements");
const { bulkInsert } = require("../utils/insert-measurements");
const { filterMeasurementsWithExistingDevices } = require("../utils/does-component-exist");

const constants = require("../config/constants");
const RAW_MEASUREMENTS_TOPICS = constants.KAFKA_RAW_MEASUREMENTS_TOPICS;
const KAFKA_CLIENT_GROUP = constants.KAFKA_CLIENT_GROUP;

const rawEventsConsumer = async () => {

  const consumer = kafkaClient.consumer({ groupId: KAFKA_CLIENT_GROUP })

  await consumer.connect();

  const topics = RAW_MEASUREMENTS_TOPICS.split(",");

  for (const topic of topics) {
    await consumer.subscribe({ topic: topic.trim().toLowerCase(), fromBeginning: true });
  }
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try{
        const decodedValue = await schemaRegistry.decode(message.value)
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

const rawEventsConsumerV2 = () => {

  const Consumer = kafkaClientV2.Consumer;

  const topics = RAW_MEASUREMENTS_TOPICS.split(",");
  const consumerTopics = [];

  for (const topic of topics) {
    consumerTopics.push({topic: topic});
  }

  const consumerOptions = {
    autoCommit: false,
    groupId: KAFKA_CLIENT_GROUP,
  };
  
  let kafkaConsumer = new Consumer(kafkaClient, consumerTopics, consumerOptions);
  kafkaConsumer.on('message', function (message) {
  
      try {
          const decodedMessage = schemaRegistryV2.decode(message)
          logObject("Kafka Message Received", decodedMessage);
  
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


module.exports = { rawEventsConsumer, rawEventsConsumerV2 };
