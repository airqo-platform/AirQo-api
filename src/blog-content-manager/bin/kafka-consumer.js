const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/kafka-consumer script`
);
const { logObject } = require("@utils/log");
const mailer = require("@utils/mailer");
const emailTemplates = require("@utils/email.templates");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");
const stringify = require("@utils/stringify");
const rangeCheck = require("ip-range-check");
const asyncRetry = require("async-retry");

const userSchema = Joi.object({
  email: Joi.string().email().empty("").required(),
}).unknown(true);

const operationFunction2 = async (messageData) => {};

const kafkaConsumer = async () => {
  try {
    const kafka = new Kafka({
      clientId: constants.KAFKA_CLIENT_ID,
      brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
      fetchMaxWaitMs: 500, // Set a maximum threshold for time-based batching
      fetchMinBytes: 16384, // Set a minimum threshold for size-based batching
    });

    const consumer = kafka.consumer({
      groupId: constants.UNIQUE_CONSUMER_GROUP,
    });

    // Define topic-to-operation function mapping
    const topicOperations = {
      // ["new-mobile-app-user-topic"]: operationForNewMobileAppUser,
      // topic2: operationFunction2,
    };
    await consumer.connect();
    // Subscribe to all topics in the mapping
    await Promise.all(
      Object.keys(topicOperations).map(async (topic) => {
        consumer.subscribe({ topic, fromBeginning: true });
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
                `🐛🐛 Error processing Kafka message for topic ${topic}: ${stringify(
                  error
                )}`
              );
            }
          },
        });
      })
    );
  } catch (error) {
    logObject("📶📶 Error connecting to Kafka", error);
    logger.error(`📶📶 Error connecting to Kafka: ${stringify(error)}`);
  }
};

module.exports = kafkaConsumer;
