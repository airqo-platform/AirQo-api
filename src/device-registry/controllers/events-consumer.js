const { kafkaClient, consumerOptions, schemaRegistry, kafkaClientV2, schemaRegistryV2 } = require('../config/kafka');

const { logObject, logElement } = require("../utils/log");
const { transformMeasurements_v2 } = require("../utils/transform-measurements");
const { bulkInsert } = require("../utils/insert-measurements");
const { filterMeasurementsWithExistingDevices } = require("../utils/does-component-exist");
const { getTopic, TOPICS } = require("../utils/kafka-topics")


const rawEventsConsumer = async () => {

  const consumer = kafkaClient.consumer(consumerOptions)
  await consumer.connect();

  const topics = getTopic(TOPICS.RAW_MEASUREMENTS_TOPICS).split(",");

  for (const topic of topics) {
    await consumer.subscribe({ topic: topic.trim().toLowerCase(), fromBeginning: true });
  }
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try{
        const decodedValue = await schemaRegistry.decode(message.value);
        let measurements = JSON.parse(JSON.stringify(decodedValue.measurements));

        if (Array.isArray(measurements)) {
  
          const valid_measurements = await filterMeasurementsWithExistingDevices(measurements);
          const transformedMeasurements = await transformMeasurements_v2(valid_measurements);
          const response = await bulkInsert(transformedMeasurements.data);
          
          logObject("Insertion Response", JSON.stringify(response));
        }
        else{
          logObject("Invalid Array of measurements", measurements );
        }

      }
      catch (e) {
        logObject("Kafka Raw Measurements consumer", e);
      }
    },
  });
}

const rawEventsConsumerV2 = () => {

  const Consumer = kafkaClientV2.Consumer;

  const topics = getTopic(TOPICS.RAW_MEASUREMENTS_TOPICS).split(",");
  const consumerTopics = [];

  for (const topic of topics) {
    consumerTopics.push({topic: topic});
  }
  
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
