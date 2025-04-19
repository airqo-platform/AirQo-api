// bin/jobs/message-consumer.js
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/message-consumer script`
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
const messagingService =
  require("@utils/messaging/messaging-service").getInstance();
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

const operationForNewMobileAppUser = async (topic, messageData) => {
  try {
    logger.info(
      `Successfully received the new User --- ${stringify({
        value: messageData,
      })}`
    );
    logObject("message.value", messageData);

    // If messageData is already an object, no need to repair JSON
    let emailDetailsToSend;
    if (typeof messageData === "string") {
      const repairedJSONString = jsonrepair(messageData);
      emailDetailsToSend = JSON.parse(repairedJSONString);
    } else {
      emailDetailsToSend = messageData;
    }

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
        `🤦🤦 ALL the input validation errors --- ${stringify(error.details)}`
      );
    } else {
      const responseFromSendEmail = await mailer.newMobileAppUser(
        emailDetailsToSend
      );

      if (responseFromSendEmail.success === true) {
        logger.info(
          `Successfully received the new Mobile App User --- ${stringify(
            responseFromSendEmail
          )}`
        );
      } else if (responseFromSendEmail.success === false) {
        logger.error(
          `🐛🐛 Unable to send email for new Mobile App User --- ${stringify(
            responseFromSendEmail
          )}`
        );
      }
    }
  } catch (error) {
    logger.error(
      `🐛🐛 Internal server error -- operationForNewMobileAppUser() -- ${stringify(
        error
      )}`
    );
  }
};

const operationForBlacklistedIPs = async (topic, messageData) => {
  try {
    // Parse the message if needed
    const ipData =
      typeof messageData === "string" ? JSON.parse(messageData) : messageData;
    const { ip } = ipData;

    if (!ip) {
      logger.error("IP address is missing in the message");
      return;
    }

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
              } catch (error) {
                if (error.name === "MongoError" && error.code !== 11000) {
                  logger.error(
                    `🐛🐛 MongoError -- operationForBlacklistedIPs -- ${stringify(
                      error
                    )}`
                  );
                  throw error; // Retry the operation
                } else if (error.code === 11000) {
                  // Ignore duplicate key errors
                  console.warn(
                    `Duplicate key error for document: ${stringify(doc)}`
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
      `🐛🐛 Internal Server Error -- operationForBlacklistedIPs() -- ${stringify(
        error
      )}`
    );
  }
};

const emailsForDeployedDevices = async (topic, messageData) => {
  let parsedData;
  try {
    // Handle both string and object formats
    if (typeof messageData === "string") {
      if (messageData.includes("action")) {
        // Handle the Kafka format with action field
        const parsed = JSON.parse(messageData);
        if (parsed.action === "create" && parsed.value) {
          parsedData = JSON.parse(parsed.value);
        } else {
          parsedData = parsed;
        }
      } else {
        parsedData = JSON.parse(messageData);
      }
    } else if (messageData.action === "create" && messageData.value) {
      // Object with the action/value format
      parsedData = JSON.parse(messageData.value);
    } else {
      parsedData = messageData;
    }
  } catch (error) {
    logger.error(`🐛🐛 Invalid JSON format in messageData: ${error.message}`);
    return;
  }

  const { createdActivity, updatedDevice, user_id } = parsedData;

  // Validate input data
  if (!createdActivity || !updatedDevice || !user_id) {
    logger.error(
      `🤦🤦 Invalid input data: Missing required fields -- parsedData: ${stringify(
        parsedData
      )}`
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
      activityType: "deploy",
    });

    // Handle email response
    if (emailResponse && emailResponse.success === false) {
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`);
    } else {
      logger.info(
        `✅ Successfully sent deployment email to ${user.email} for device ${updatedDevice.name}`
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
  }
};

const emailsForRecalledDevices = async (topic, messageData) => {
  // Parse the message and validate input data
  let parsedData;
  try {
    // Similar parsing logic as emailsForDeployedDevices
    if (typeof messageData === "string") {
      if (messageData.includes("action")) {
        const parsed = JSON.parse(messageData);
        if (parsed.action === "create" && parsed.value) {
          parsedData = JSON.parse(parsed.value);
        } else {
          parsedData = parsed;
        }
      } else {
        parsedData = JSON.parse(messageData);
      }
    } else if (messageData.action === "create" && messageData.value) {
      parsedData = JSON.parse(messageData.value);
    } else {
      parsedData = messageData;
    }
  } catch (error) {
    logger.error(`🐛🐛 Invalid JSON format in messageData: ${error.message}`);
    return;
  }

  const { createdActivity, updatedDevice, user_id } = parsedData;

  if (!createdActivity || !updatedDevice || !user_id) {
    logger.error("🤦🤦 Invalid input data: Missing required fields.");
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
        `✅ Successfully sent recall email to ${user.email} for device ${updatedDevice.name}`
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
  }
};

const operationForSiteCreated = async (topic, messageData) => {
  try {
    const event =
      typeof messageData === "string" ? JSON.parse(messageData) : messageData;
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
      } else {
        logger.info(`✅ Successfully added site ${siteId} to group ${groupId}`);
      }
    }
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error -- operationForSiteCreated() -- ${stringify(
        error
      )}`
    );
  }
};

// Map topics to their handler functions
const topicHandlers = {
  [constants.IP_ADDRESS_TOPIC]: operationForBlacklistedIPs,
  [constants.DEPLOY_TOPIC]: emailsForDeployedDevices,
  [constants.RECALL_TOPIC]: emailsForRecalledDevices,
  [constants.SITES_TOPIC]: operationForSiteCreated,
};

/**
 * Initial connection retry handler
 * @param {Function} fn - The function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} - The result of the function
 */
const withRetry = async (fn, options = {}) => {
  const retryOptions = {
    retries: options.retries || 5,
    factor: options.factor || 2,
    minTimeout: options.minTimeout || 1000,
    maxTimeout: options.maxTimeout || 60000,
    randomize: true,
    onRetry: (error) => {
      logger.warn(`Retrying operation after error: ${error.message}`);
    },
  };

  return asyncRetry(retryOptions, fn);
};

/**
 * Main message consumer function that initializes and starts the consumer
 */
const messageConsumer = async () => {
  try {
    logger.info("Message consumer starting up...");

    // Initialize the messaging service with retry
    await withRetry(async () => {
      await messagingService.initialize();
      logger.info(`Messaging service initialized successfully`);
    });

    // Get all topic names from the handlers map
    const topics = Object.keys(topicHandlers);
    logger.info(`Subscribing to topics: ${topics.join(", ")}`);

    // Subscribe to all topics with the appropriate handler
    const subscriptionResult = await messagingService.subscribe(
      topics,
      async (topic, message) => {
        try {
          const handler = topicHandlers[topic];
          if (handler) {
            logger.info(`Processing message from topic: ${topic}`);
            await handler(topic, message);
          } else {
            logger.error(`🐛🐛 No handler defined for topic: ${topic}`);
          }
        } catch (error) {
          logger.error(
            `Error processing message from topic ${topic}: ${error.message}`
          );
          // Optionally implement retry logic here for message processing
        }
      },
      { groupId: constants.UNIQUE_CONSUMER_GROUP }
    );

    logger.info(
      `Message consumer subscribed successfully using ${messagingService.getActiveBrokerType()} broker`
    );

    // Log subscription results for each broker
    if (subscriptionResult && subscriptionResult.results) {
      subscriptionResult.results.forEach((result) => {
        if (result.success) {
          logger.info(
            `Successfully subscribed to topics with ${result.broker} broker`
          );
        } else {
          logger.warn(
            `Failed to subscribe to topics with ${result.broker} broker: ${result.error}`
          );
        }
      });
    }

    // Keep the process alive
    process.on("SIGINT", async () => {
      logger.info("Caught SIGINT signal. Shutting down message consumer...");
      await messagingService.shutdown();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      logger.info("Caught SIGTERM signal. Shutting down message consumer...");
      await messagingService.shutdown();
      process.exit(0);
    });

    // Set up periodic health checks
    setInterval(async () => {
      const activeBroker = messagingService.getActiveBrokerType();
      logger.info(`Health check: Current active broker is ${activeBroker}`);
    }, 300000); // Every 5 minutes

    // Return success info
    return {
      success: true,
      message: "Message consumer started successfully",
      activeBroker: messagingService.getActiveBrokerType(),
    };
  } catch (error) {
    logObject("Error in messageConsumer()", error);
    logger.error(`📶📶 Error starting message consumer: ${stringify(error)}`);

    // Implement auto-restart after delay
    logger.info("Will attempt to restart consumer in 30 seconds...");
    setTimeout(() => {
      logger.info("Attempting to restart message consumer...");
      messageConsumer().catch((e) => {
        logObject("Error in messageConsumer() restart", e);
        logger.error(`Failed to restart message consumer: ${e.message}`);
      });
    }, 30000);

    return {
      success: false,
      message: `Failed to start message consumer: ${error.message}`,
    };
  }
};

module.exports = messageConsumer;
