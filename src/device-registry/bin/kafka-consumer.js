const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- Kafka Consumer`);
const { logText, logObject, logElement } = require("@utils/log");
const createEvent = require("@utils/create-event");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");
const cleanDeep = require("clean-deep");

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

const eventsSchema = Joi.array().items(eventSchema);

const consumeHourlyMeasurements = async (messageData) => {
  try {
    if (isEmpty(messageData)) {
      logger.error(
        `KAFKA: the sent message in undefined --- ${JSON.stringify(
          messageData
        )}`
      );
    }
    const repairedJSONString = jsonrepair(messageData);
    logObject("original string", messageData);
    logObject("repaired string", repairedJSONString);
    const measurements = JSON.parse(repairedJSONString).data;
    // const measurements = JSON.parse(repairedJSONString);
    if (!Array.isArray(measurements) || isEmpty(measurements)) {
      logger.error(
        `KAFKA: the sent measurements are not an array or they are just empty (undefined) --- ${JSON.stringify(
          measurements
        )}`
      );
    } else {
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
        logObject("error.details[0].message", error.details[0].message);
        logObject("error.details[0]", error.details[0]);
        logObject("error.details", error.details);
        const errorDetails = error.details.map((detail) => {
          const event = detail.context.value;
          logObject("KAFKA: the event causing the error", event);
          const {
            device_number,
            device_id,
            timestamp,
            site_id,
            battery,
            network,
            device_latitude,
            device_longitude,
            site_latitude,
            site_longitude,
          } = value[detail.path[0]];
          return {
            message: detail.message,
            key: detail.context.key,
            value: detail.context.value,
            device_number: device_number ? device_number : undefined,
            timestamp: timestamp ? timestamp : undefined,
          };
        });
        logger.error(
          `KAFKA: Input validation formatted errors -- ${JSON.stringify(
            errorDetails
          )}`
        );

        // logger.error(
        //     `KAFKA: ALL the input validation errors --- ${JSON.stringify(error.details)}`
        // );

        // logger.info(
        //     `KAFKA: the VALUE for ALL the shared input validation errors --- ${JSON.stringify(value)}`
        // );
      } else {
        logObject("value", value);
        logObject("cleanedMeasurements", cleanedMeasurements);
        const request = {
          body: cleanedMeasurements,
        };
        const responseFromInsertMeasurements = await createEvent.create(
          request
        );

        logObject(
          "responseFromInsertMeasurements",
          responseFromInsertMeasurements
        );

        if (responseFromInsertMeasurements.success === false) {
          //         logger.error(
          //             `KAFKA: responseFromInsertMeasurements --- ${JSON.stringify(
          //   responseFromInsertMeasurements
          // )}`
          //         );
        } else if (responseFromInsertMeasurements.success === true) {
          // logger.info(
          //     `KAFKA: successfully inserted the measurements --- ${JSON.stringify(responseFromInsertMeasurements.message ?
          //     responseFromInsertMeasurements.message :
          //     "")}`
          // );
        }
      }
    }
  } catch (error) {
    logObject("error", error);
    logger.info(
      `incoming KAFKA value which is causing errors --- ${message.value.toString()}`
    );
    logger.info(
      `incoming KAFKA value's TYPE which is causing errors --- ${typeof message.value}`
    );
    logger.error(`KAFKA: error message --- ${error.message}`);
    logger.error(`KAFKA: full error object --- ${JSON.stringify(error)}`);
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
    [constants.HOURLY_MEASUREMENTS_TOPIC]: consumeHourlyMeasurements,
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
