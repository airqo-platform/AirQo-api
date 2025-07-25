const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/kafka-consumer script`
);
const { mailer, stringify, emailTemplates } = require("@utils/common");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");
const BlacklistedIPRangeModel = require("@models/BlacklistedIPRange");
const BlacklistedIPModel = require("@models/BlacklistedIP");
const UserModel = require("@models/User");
const rangeCheck = require("ip-range-check");
const asyncRetry = require("async-retry");
const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const ObjectId = mongoose.Types.ObjectId;
const GroupModel = require("@models/Group");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const userSchema = Joi.object({
  email: Joi.string().email().empty("").required(),
}).unknown(true);

const extractDeviceDetails = (updatedDevice) => {
  const {
    _id,
    status,
    category,
    isActive,
    long_name,
    device_number,
    name,
    deployment_date,
    latitude,
    longitude,
    mountType,
    powerType,
  } = updatedDevice;

  return {
    status,
    category,
    _id,
    isActive,
    long_name,
    device_number,
    name,
    deployment_date,
    latitude,
    longitude,
    mountType,
    powerType,
  };
};

const extractActivityDetails = (createdActivity) => {
  return {
    ...createdActivity, // Spread operator to include all properties directly
  };
};

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
        `🤦🤦 KAFKA: ALL the input validation errors --- ${stringify(
          error.details
        )}`
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
          `🐛🐛 KAFKA: unable to send email for new Mobile App User --- ${stringify(
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

const emailsForDeployedDevices = async (messageData) => {
  let parsedData;
  try {
    parsedData = JSON.parse(messageData);
  } catch (error) {
    logger.error("🐛🐛 Invalid JSON format in messageData.");
    return;
  }

  const { createdActivity, updatedDevice, user_id } = parsedData;

  if (!createdActivity || !updatedDevice) {
    logger.error(
      `🤦🤦 Invalid input data: Missing required fields (createdActivity or updatedDevice) -- parsedData: ${stringify(
        parsedData
      )}`
    );
    return;
  }

  if (user_id === null || user_id === undefined) {
    logger.info(
      `📧 Skipping email notification - no user_id provided for deployment of device: ${createdActivity.device}`
    );
    return; // Exit gracefully without error
  }

  // FIXED: Additional validation for user_id format (only if provided)
  if (!ObjectId.isValid(user_id)) {
    logger.error(`🤦🤦 Invalid user_id format: ${user_id}`);
    return;
  }

  try {
    const user = await UserModel("airqo")
      .findOne({ _id: ObjectId(user_id) }, "email _id firstName lastName")
      .lean();

    // Check if user exists
    if (!user) {
      logger.error(`🤦🤦 User not found for user_id: ${user_id}`);
      return;
    }

    const emailResponse = await mailer.fieldActivity({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      deviceDetails: extractDeviceDetails(updatedDevice),
      activityDetails: extractActivityDetails(createdActivity),
      activityType: "deploy",
    });

    // Handle email response
    if (emailResponse && emailResponse.success === false) {
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`);
    } else {
      logger.info(
        `📧 Successfully sent deployment email for device: ${createdActivity.device}`
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
  }
};

const emailsForRecalledDevices = async (messageData) => {
  let parsedData;
  try {
    parsedData = JSON.parse(messageData);
  } catch (error) {
    logger.error("🐛🐛 Invalid JSON format in messageData.");
    return;
  }

  const { createdActivity, updatedDevice, user_id } = parsedData;

  if (!createdActivity || !updatedDevice) {
    logger.error(
      `🤦🤦 Invalid input data: Missing required fields (createdActivity or updatedDevice) -- parsedData: ${stringify(
        parsedData
      )}`
    );
    return;
  }

  if (user_id === null || user_id === undefined) {
    logger.info(
      `📧 Skipping email notification - no user_id provided for recall of device: ${createdActivity.device}`
    );
    return;
  }

  if (!ObjectId.isValid(user_id)) {
    logger.error(`🤦🤦 Invalid user_id format: ${user_id}`);
    return;
  }

  try {
    const user = await UserModel("airqo")
      .findOne({ _id: ObjectId(user_id) }, "email _id firstName lastName")
      .lean();

    // Check if user exists
    if (!user) {
      logger.error(`🤦🤦 User not found for user_id: ${user_id}`);
      return;
    }

    const emailResponse = await mailer.fieldActivity({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      deviceDetails: extractDeviceDetails(updatedDevice),
      activityDetails: extractActivityDetails(createdActivity),
      activityType: "recall",
    });

    // Handle email response
    if (emailResponse && emailResponse.success === false) {
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`);
    } else {
      logger.info(
        `📧 Successfully sent recall email for device: ${createdActivity.device}`
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
  }
};
const operationForSiteCreated = async (messageData) => {
  try {
    const event = JSON.parse(messageData);
    logObject("site.created event", event);

    if (event.groupId) {
      const { siteId, groupId, tenant } = event;
      // Validate that IDs are proper ObjectIds before proceeding
      if (!ObjectId.isValid(siteId) || !ObjectId.isValid(groupId)) {
        logger.error(
          `🛑 Invalid ObjectId format - siteId: ${siteId}, groupId: ${groupId}`
        );
        return;
      }

      // Check if the group exists before attempting to update
      const groupExists = await GroupModel(tenant).findOne({ _id: groupId });
      if (!groupExists) {
        logger.error(
          `🛑 Group with ID ${groupId} not found for tenant ${tenant}`
        );
        return;
      }
      const filter = { _id: groupId };
      const update = { $addToSet: { grp_sites: siteId } };
      const options = { new: true };
      const responseFromModifyGroup = await GroupModel(tenant).modify(
        { filter, update },
        (error) => {
          if (error) {
            logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
          }
        }
      );
      logObject("responseFromModifyGroup", responseFromModifyGroup);
      if (responseFromModifyGroup.success === false) {
        logger.error(
          `🐛🐛 Internal Server Error -- ${responseFromModifyGroup.message}`
        );
      }
    }
  } catch (error) {
    logger.error(
      `🐛🐛 KAFKA: Internal Server Error -- operationForSiteCreated() -- ${stringify(
        error
      )}`
    );
  }
};

const kafkaConsumer = async () => {
  try {
    const kafka = new Kafka({
      clientId: constants.KAFKA_CLIENT_ID,
      brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
      fetchMaxWaitMs: 500,
      fetchMinBytes: 16384,
    });

    const consumer = kafka.consumer({
      groupId: constants.UNIQUE_CONSUMER_GROUP,
    });

    // Define topic-to-operation function mapping
    const topicOperations = {
      ["ip-address"]: operationForBlacklistedIPs,
      ["deploy-topic"]: emailsForDeployedDevices,
      ["recall-topic"]: emailsForRecalledDevices,
      ["sites-topic"]: operationForSiteCreated,
    };

    await consumer.connect();

    // First, subscribe to all topics
    await Promise.all(
      Object.keys(topicOperations).map((topic) =>
        consumer.subscribe({ topic, fromBeginning: true })
      )
    );

    // Then, start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const operation = topicOperations[topic];
          if (operation) {
            const messageData = message.value.toString();
            await operation(messageData);
          } else {
            logger.error(`🐛🐛 No operation defined for topic: ${topic}`);
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
  } catch (error) {
    logObject("📶📶 Error connecting to Kafka", error);
    logger.error(`📶📶 Error connecting to Kafka: ${stringify(error)}`);
  }
};

module.exports = kafkaConsumer;
