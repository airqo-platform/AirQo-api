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
const rangeCheck = require("ip-range-check");
const asyncRetry = require("async-retry");

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
      blacklistedRanges = await Promise.all([
        BlacklistedIPRangeModel("airqo")
          .find()
          .skip((pageNumber - 1) * 1000)
          .limit(1000),
      ]);

      if (blacklistedRanges.length === 0 || blacklistedRanges[0].length === 0) {
        // If no more ranges, break the loop
        break;
      }

      // Iterate over each range
      for (const range of blacklistedRanges[0]) {
        // Check if the IP falls within the range
        if (rangeCheck(ip, range.range)) {
          // If the IP falls within the range, add it to the list of IPs to blacklist
          ipsToBlacklist.push(ip);
          logger.info(`💪💪 IP ${ip} has been queued for blacklisting...`);
          break;
        }
      }

      pageNumber++;
    }

    // if (ipsToBlacklist.length > 0) {
    //   await BlacklistedIPModel("airqo").insertMany(
    //     ipsToBlacklist.map((ip) => ({ ip }))
    //   );
    // }

    if (ipsToBlacklist.length > 0) {
      //prepare for batch operations....
      const batchSize = 20;
      const batches = [];
      for (let i = 0; i < ipsToBlacklist.length; i += batchSize) {
        batches.push(ipsToBlacklist.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        for (const ip of batch) {
          const doc = { ip: ip };
          await asyncRetry(
            async (bail) => {
              try {
                const res = await BlacklistedIPModel("airqo").updateOne(
                  doc,
                  doc,
                  {
                    upsert: true,
                  }
                );
                logObject("res", res);
                // logObject("Number of documents updated", res.modifiedCount);
              } catch (error) {
                if (error.name === "MongoError" && error.code !== 11000) {
                  logger.error(
                    `🐛🐛 MongoError -- operationForBlacklistedIPs -- ${jsonify(
                      error
                    )}`
                  );
                  throw error; // Retry the operation
                } else if (error.code === 11000) {
                  // Ignore duplicate key errors
                  console.warn(
                    `Duplicate key error for document: ${jsonify(doc)}`
                  );
                }
              }
            },
            {
              retries: 5, // Number of retry attempts
              minTimeout: 1000, // Initial delay between retries (in milliseconds)
              factor: 2, // Exponential factor for increasing delay between retries
            }
          );
        }
      }
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
      fetchMaxWaitMs: 500, // Set a maximum threshold for time-based batching
      fetchMinBytes: 16384, // Set a minimum threshold for size-based batching
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
    logObject("📶📶 Error connecting to Kafka", error);
    logger.error(`📶📶 Error connecting to Kafka: ${stringify(error)}`);
  }
};

module.exports = kafkaConsumer;
