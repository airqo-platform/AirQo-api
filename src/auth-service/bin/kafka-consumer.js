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
const BlacklistedIPRangeModel = require("@models/BlacklistedIPRange");
const BlacklistedIPModel = require("@models/BlacklistedIP");
const stringify = require("@utils/stringify");

const userSchema = Joi.object({
  email: Joi.string().email().empty("").required(),
}).unknown(true);

const operationForNewMobileAppUser = async (messageData) => {
  try {
    logger.info(
      `KAFKA: successfully received the new User --- ${stringify({
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
        `KAFKA: ALL the input validation errors --- ${stringify(error.details)}`
      );
    } else {
      const responseFromSendEmail = await mailer.newMobileAppUser(
        emailDetailsToSend
      );

      if (responseFromSendEmail.success === true) {
        logger.info(
          `KAFKA: successfully received the new Mobile App User --- ${stringify(
            responseFromSendEmail
          )}`
        );
      } else if (responseFromSendEmail.success === false) {
        logger.error(
          `KAFKA: unable to send email for new Mobile App User --- ${stringify(
            responseFromSendEmail
          )}`
        );
      }
    }
  } catch (error) {
    logger.error(
      `🐛🐛 KAFKA: internal server error -- operationForNewMobileAppUser() -- ${stringify(
        error
      )}`
    );
  }
};
const operationForBlacklistedIPs = async (messageData) => {
  try {
    // Parse the message
    const { ip } = JSON.parse(messageData);

    let pageNumber = 1;
    let blacklistedRanges = [];
    let ipsToBlacklist = [];

    // Keep fetching and checking until we have gone through all records
    while (true) {
      // Fetch the next page of blacklisted ranges
      blacklistedRanges = await BlacklistedIPRangeModel("airqo")
        .find()
        .skip((pageNumber - 1) * 1000)
        .limit(1000);

      if (blacklistedRanges.length === 0) {
        // If no more ranges, break the loop
        break;
      }

      // Iterate over each range
      for (const range of blacklistedRanges) {
        // Check if the IP falls within the range
        if (await rangeCheck(ip, range.range)) {
          // If the IP falls within the range, add it to the list of IPs to blacklist
          ipsToBlacklist.push(ip);
          break;
        }
      }

      pageNumber++;
    }

    // If there are any IPs to blacklist, add them to the blacklist in a single operation
    if (ipsToBlacklist.length > 0) {
      await BlacklistedIPModel("airqo").insertMany(
        ipsToBlacklist.map((ip) => ({ ip }))
      );
    }
  } catch (error) {
    logger.error(
      `🐛🐛 KAFKA: Internal Server Error -- operationForBlacklistedIPs() -- ${stringify(
        error
      )}`
    );
  }
};
const operationFunction2 = async (messageData) => {};

const kafkaConsumer = async () => {
  try {
    const kafka = new Kafka({
      clientId: constants.KAFKA_CLIENT_ID,
      brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
    });

    const consumer = kafka.consumer({
      groupId: constants.UNIQUE_CONSUMER_GROUP,
    });

    // Define topic-to-operation function mapping
    const topicOperations = {
      // ["new-mobile-app-user-topic"]: operationForNewMobileAppUser,
      ["ip-address"]: operationForBlacklistedIPs,
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
    logObject("Error connecting to Kafka", error);
    logger.error(`📶📶 Error connecting to Kafka: ${stringify(error)}`);
  }
};

module.exports = kafkaConsumer;
