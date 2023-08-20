const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/kafka-consumer script`
);
const { logText, logObject } = require("@utils/log");
const mailer = require("@utils/mailer");
const emailTemplates = require("@utils/email.templates");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");

const userSchema = Joi.object({
  email: Joi.string().email().empty("").required(),
}).unknown(true);

const operationForNewMobileAppUser = async (messageData) => {
  try {
    logger.info(
      `KAFKA: successfully received the new User --- ${JSON.stringify({
        value: messageData,
      })}`
    );
    logObject("message.value.toString()", messageData);

    const repairedJSONString = jsonrepair(messageData);
    logObject("message.value", JSON.parse(repairedJSONString));

    let emailDetailsToSend = JSON.parse(repairedJSONString);
    emailDetailsToSend.message = emailTemplates.mobileAppWelcome();
    emailDetailsToSend.subject = "Welcome to AirQo!";

    const options = {
      abortEarly: false,
    };

    const { error, value } = userSchema.validate(emailDetailsToSend, options);

    if (error) {
      logObject("error.details[0].message", error.details[0].message);
      logObject("error.details[0]", error.details[0]);
      logObject("error.details", error.details);
      logger.error(
        `KAFKA: ALL the input validation errors --- ${JSON.stringify(
          error.details
        )}`
      );
    } else {
      const responseFromSendEmail = await mailer.newMobileAppUser(
        emailDetailsToSend
      );

      if (responseFromSendEmail.success === true) {
        logger.info(
          `KAFKA: successfully received the new Mobile App User --- ${JSON.stringify(
            responseFromSendEmail
          )}`
        );
      } else if (responseFromSendEmail.success === false) {
        logger.error(
          `KAFKA: unable to send email for new Mobile App User --- ${JSON.stringify(
            responseFromSendEmail
          )}`
        );
      }
    }
  } catch (error) {
    logger.error(
      `KAFKA error: inside operationForNewMobileAppUser() -- ${JSON.stringify(
        error
      )} `
    );
  }
};

const operationFunction2 = async (messageData) => {
  // Operation logic for topic2
  // You can perform a different operation here
};

const kafkaConsumer = async () => {
  const kafka = new Kafka({
    clientId: constants.KAFKA_CLIENT_ID,
    brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
  });

  const consumer = kafka.consumer({ groupId: constants.UNIQUE_CONSUMER_GROUP });

  // Define topic-to-operation function mapping
  const topicOperations = {
    [constants.NEW_MOBILE_APP_USER_TOPIC]: operationForNewMobileAppUser.catch(
      (error) => {
        logger.error(
          `KAFKA: error when calling operationForNewMobileAppUser() -- ${JSON.stringify(
            error
          )} `
        );
      }
    ),
    // topic2: operationFunction2,
    // Add more topics and their corresponding functions as needed
  };

  try {
    await consumer.connect();
    // Subscribe to all topics in the mapping
    await Promise.all(
      Object.keys(topicOperations).map(async (topic_id) => {
        consumer.subscribe({ topic: topic_id, fromBeginning: true });
        await consumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            try {
              const operation = topicOperations[topic_id];
              if (operation) {
                // const messageData = JSON.parse(message.value.toString());
                const messageData = message.value.toString();
                await operation(messageData);
              } else {
                logger.error(`No operation defined for topic: ${topic_id}`);
              }
            } catch (error) {
              logger.error(
                `Error processing Kafka message for topic ${topic_id}: ${JSON.stringify(
                  error
                )}`
              );
            }
          },
        });
      })
    );
  } catch (error) {
    logger.error(`Error connecting to Kafka: ${JSON.stringify(error)}`);
  }
};

module.exports = kafkaConsumer;
