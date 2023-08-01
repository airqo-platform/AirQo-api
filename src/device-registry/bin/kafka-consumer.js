const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- Kafka Consumer`);
const { logText, logObject } = require("@utils/log");

const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");

const eventSchema = Joi.object({
  s2_pm2_5: Joi.number().optional(),
  s2_pm10: Joi.number().optional(),
  longitude: Joi.number()
    .precision(5)
    .optional(),
  satellites: Joi.number().optional(),
  hdop: Joi.number().optional(),
  altitude: Joi.number().optional(),
  s1_pm2_5: Joi.number().optional(),
  battery: Joi.number().optional(),
  device_humidity: Joi.number().optional(),
  s1_pm10: Joi.number().optional(),
  device_temperature: Joi.number().optional(),
  latitude: Joi.number()
    .precision(5)
    .optional(),
  pm2_5_raw_value: Joi.number().optional(),
  pm2_5: Joi.number().optional(),
  pm10_raw_value: Joi.number().optional(),
  pm10: Joi.number().optional(),
  timestamp: Joi.date()
    .iso()
    .required(),
  device_id: Joi.string()
    .empty("")
    .required(),
  site_id: Joi.string().required(),
  device_number: Joi.number().optional(),
  atmospheric_pressure: Joi.number().optional(),
  humidity: Joi.number().optional(),
  temperature: Joi.number().optional(),
  wind_direction: Joi.number().optional(),
  wind_gusts: Joi.number().optional(),
  radiation: Joi.number().optional(),
  wind_speed: Joi.number().optional(),
  vapor_pressure: Joi.number().optional(),
  precipitation: Joi.number().optional(),
  station_code: Joi.string()
    .empty("")
    .optional(),
  pm2_5_calibrated_value: Joi.number().optional(),
  pm10_calibrated_value: Joi.number().optional(),
}).unknown(true);

const operationFunction1 = async (messageData) => {
  try {
    logger.info(
      `KAFKA: successfully received the new User --- ${JSON.stringify({
        value: messageData,
      })}`
    );
    logObject("message.value.toString()", messageData);

    const repairedJSONString = jsonrepair(messageData);
    logObject("message.value", JSON.parse(repairedJSONString));

    const options = {
      abortEarly: false,
    };

    const { error, value } = eventSchema.validate(repairedJSONString, options);

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
      /**
       * perform action fro here
       * real action
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
    clientId: constants.KAFKA_CLIENT_ID,
    brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
  });

  const consumer = kafka.consumer({ groupId: constants.UNIQUE_CONSUMER_GROUP });

  // Define topic-to-operation function mapping
  const topicOperations = {
    [constants.NEW_MOBILE_APP_USER_TOPIC]: operationFunction1,
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
            // const messageData = JSON.parse(message.value.toString());
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
