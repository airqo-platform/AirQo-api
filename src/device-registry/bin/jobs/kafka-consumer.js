const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/kafka-consumer`
);
const { logObject } = require("@utils/log");
const createEvent = require("@utils/create-event");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");
const cleanDeep = require("clean-deep");
const isEmpty = require("is-empty");
const stringify = require("@utils/stringify");

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
  tvoc: Joi.number().optional(),
  hcho: Joi.number().optional(),
  co2: Joi.number().optional(),
  intaketemperature: Joi.number().optional(),
  intakehumidity: Joi.number().optional(),
}).unknown(true);

const eventsSchema = Joi.array().items(eventSchema);

const consumeHourlyMeasurements = async (messageData) => {
  try {
    if (isEmpty(messageData)) {
      logger.error(
        `KAFKA: the sent message in undefined --- ${stringify(messageData)}`
      );
      return;
    }

    const repairedJSONString = jsonrepair(messageData);
    const measurements = JSON.parse(repairedJSONString).data;

    if (!Array.isArray(measurements) || isEmpty(measurements)) {
      return;
    }

    const cleanedMeasurements = measurements.map((obj) =>
      cleanDeep(obj, { cleanValues: ["NaN"] })
    );

    const options = {
      abortEarly: false,
    };

    const { error, value } = eventsSchema.validate(
      cleanedMeasurements,
      options
    );

    if (error) {
      const errorDetails = error.details.map((detail) => {
        const { device_number, timestamp } = value[detail.path[0]];
        return {
          message: detail.message,
          key: detail.context.key,
          device_number,
          timestamp,
        };
      });
    }

    const request = {
      body: cleanedMeasurements,
    };

    const responseFromInsertMeasurements = await createEvent.create(request);

    if (responseFromInsertMeasurements.success === false) {
      console.log("KAFKA: failed to store the measurements");
    } else if (responseFromInsertMeasurements.success === true) {
      console.log("KAFKA: successfully stored the measurements");
    }
  } catch (error) {
    logger.error(`🐛🐛 KAFKA: error message --- ${error.message}`);
    logger.error(`🐛🐛 KAFKA: full error object --- ${stringify(error)}`);
  }
};

const kafkaConsumer = async () => {
  try {
    const kafka = new Kafka({
      clientId: constants.KAFKA_CLIENT_ID,
      brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
    });

    const consumer = kafka.consumer({
      groupId: constants.UNIQUE_CONSUMER_GROUP,
      enableAutoCommit: true,
      autoOffsetReset: "earliest",
    });

    // Define topic-to-operation function mapping
    const topicOperations = {
      ["hourly-measurements-topic"]: consumeHourlyMeasurements,
    };

    await consumer.connect();

    // First, subscribe to all topics
    await Promise.all(
      Object.keys(topicOperations).map((topic) =>
        consumer.subscribe({ topic, fromBeginning: false })
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
    logObject("Error connecting to Kafka", error);
    logger.error(`📶📶 Error connecting to Kafka: ${stringify(error)}`);
  }
};

module.exports = kafkaConsumer;
