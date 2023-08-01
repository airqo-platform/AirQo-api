const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- Kafka Consumer`);
const { logText, logObject } = require("@utils/log");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");

const dataSchema = Joi.object({
  email: Joi.string().email().empty("").required(),
}).unknown(true);

const operationFunction1 = async (messageData) => {
  try {
    logObject("message.value.toString()", messageData);

    const repairedJSONString = jsonrepair(messageData);
    logObject("message.value", JSON.parse(repairedJSONString));

    const options = {
      abortEarly: false,
    };

    const { error, value } = dataSchema.validate(repairedJSONString, options);

    if (error) {
      logObject("error.details[0].message", error.details[0].message);
      logObject("error.details[0]", error.details[0]);
      logObject("error.details", error.details);
    } else {
      /**
       * do something....
       */
    }
  } catch (error) {}
};

const operationFunction2 = async (messageData) => {
  // Operation logic for topic2
  // You can perform a different operation here
};

const kafkaConsumer = async () => {
  const kafka = new Kafka({
    clientId: "constants.KAFKA_CLIENT_ID",
    brokers: "constants.KAFKA_BOOTSTRAP_SERVERS",
  });

  const consumer = kafka.consumer({
    groupId: "constants.UNIQUE_CONSUMER_GROUP",
  });

  // Define topic-to-operation function mapping
  const topicOperations = {
    ["constants.NEW_MOBILE_APP_USER_TOPIC"]: operationFunction1,
    topic2: operationFunction2,
    // Add more topics and their corresponding functions as needed
  };

  try {
    await consumer.connect();
    // Subscribe to all topics in the mapping
    await Promise.all(
      Object.keys(topicOperations).map((topic) =>
        consumer.subscribe({ topic, fromBeginning: true })
      )
    );

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const operation = topicOperations[topic];
          if (operation) {
            const messageData = message.value.toString();
            await operation(messageData);
          } else {
            logger.error(`No operation defined for topic: ${topic}`);
          }
        } catch (error) {
          logger.error(
            `Error processing Kafka message for topic ${topic}: ${error}`
          );
        }
      },
    });
  } catch (error) {
    logger.error(`Error connecting to Kafka: ${error}`);
  }
};

module.exports = kafkaConsumer;
