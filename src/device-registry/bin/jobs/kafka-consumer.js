//src/device-registry/bin/jobs/kafka-consumer.js
const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/kafka-consumer`
);
const { logObject, logText } = require("@utils/shared");
const createEventUtil = require("@utils/event.util");
const createForecastUtil = require("@utils/forecast.util");
const Joi = require("joi");
const { jsonrepair } = require("jsonrepair");
const cleanDeep = require("clean-deep");
const isEmpty = require("is-empty");
const CohortModel = require("@models/Cohort");
const axios = require("axios");
const createCohortUtil = require("@utils/cohort.util");

const { stringify } = require("@utils/common");

// Updated measurement schema with both nested and flat location support
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
  site_id: Joi.string().optional(),
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
  deployment_type: Joi.string()
    .valid("static", "mobile")
    .optional(),
  grid_id: Joi.string().optional(),
  location: Joi.object({
    latitude: Joi.object({
      value: Joi.number().required(),
      quality: Joi.string().optional(),
    }).optional(),
    longitude: Joi.object({
      value: Joi.number().required(),
      quality: Joi.string().optional(),
    }).optional(),
  }).optional(),
  latitude_quality: Joi.string().optional(),
  longitude_quality: Joi.string().optional(),
  tenant: Joi.string().optional(),
}).unknown(true);

// Forecast validation schemas
const forecastMeasurementsSchema = Joi.object({
  timestamp: Joi.date()
    .iso()
    .required(),
  horizon: Joi.number().required(),
  measurements: Joi.object({
    pm2_5: Joi.number().required(),
    pm10: Joi.number().required(),
    confidence: Joi.object({
      pm2_5_lower: Joi.number().required(),
      pm2_5_upper: Joi.number().required(),
      pm10_lower: Joi.number().required(),
      pm10_upper: Joi.number().required(),
    }).required(),
  }).required(),
});

const forecastSchema = Joi.object({
  type: Joi.string()
    .valid("forecast")
    .required(),
  created_at: Joi.date()
    .iso()
    .required(),
  model_version: Joi.string().required(),
  device_id: Joi.string().required(),
  site_id: Joi.string().required(),
  forecasts: Joi.array()
    .items(forecastMeasurementsSchema)
    .required(),
});

const eventsSchema = Joi.array().items(eventSchema);

/**
 * Normalizes location data from nested format to flat format
 * This ensures backward compatibility with existing downstream systems
 */
const normalizeLocationData = (measurements) => {
  return measurements.map((measurement) => {
    // If nested location format exists, unpack to flat format
    if (measurement.location) {
      const { location } = measurement;

      // Extract latitude
      if (location.latitude && location.latitude.value !== undefined) {
        // Only override if flat latitude is not already present
        if (measurement.latitude === undefined) {
          measurement.latitude = location.latitude.value;
        }
        // Store quality information in flat format
        if (location.latitude.quality) {
          measurement.latitude_quality = location.latitude.quality;
        }
      }

      // Extract longitude
      if (location.longitude && location.longitude.value !== undefined) {
        // Only override if flat longitude is not already present
        if (measurement.longitude === undefined) {
          measurement.longitude = location.longitude.value;
        }
        // Store quality information in flat format
        if (location.longitude.quality) {
          measurement.longitude_quality = location.longitude.quality;
        }
      }

      // Remove the nested location object to avoid confusion downstream
      delete measurement.location;
    }

    return measurement;
  });
};

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

    let cleanedMeasurements = measurements.map((obj) =>
      cleanDeep(obj, { cleanValues: ["NaN"] })
    );

    // Normalize location data to ensure backward compatibility
    cleanedMeasurements = normalizeLocationData(cleanedMeasurements);

    const options = {
      abortEarly: false,
    };

    const { error, value } = eventsSchema.validate(
      cleanedMeasurements,
      options
    );

    if (error) {
      const errorDetails = error.details.map((detail) => {
        const { device_number, timestamp } = value[detail.path[0]] || {};
        return {
          message: detail.message,
          key: detail.context.key,
          device_number,
          timestamp,
        };
      });
      logger.error(`Validation errors: ${stringify(errorDetails)}`);
    }

    // Parallel device context validation for better performance
    const validationPromises = cleanedMeasurements
      .filter((measurement) => measurement.device_id)
      .map(async (measurement) => {
        try {
          const deviceContext = await createEventUtil.validateDeviceContext(
            {
              device_id: measurement.device_id,
              tenant: constants.DEFAULT_TENANT || "airqo",
            },
            () => {}
          ); // Pass empty next function

          if (!deviceContext.success) {
            logger.warn(
              `Device context validation failed for ${measurement.device_id}: ${deviceContext.message}`
            );
          } else {
            logger.debug(
              `Device context validated successfully for ${measurement.device_id}`
            );
          }

          return {
            device_id: measurement.device_id,
            success: deviceContext.success,
            message: deviceContext.message,
          };
        } catch (contextError) {
          logger.warn(
            `Device context validation error for ${measurement.device_id}: ${contextError.message}`
          );
          return {
            device_id: measurement.device_id,
            success: false,
            error: contextError.message,
          };
        }
      });

    // Wait for all validations to complete (but don't block on failures)
    const validationResults = await Promise.allSettled(validationPromises);

    // Log summary of validation results
    const successful = validationResults.filter(
      (result) => result.status === "fulfilled" && result.value.success
    ).length;
    const failed = validationResults.length - successful;

    if (validationResults.length > 0) {
      logger.info(
        `Device context validation completed: ${successful} successful, ${failed} failed out of ${validationResults.length} devices`
      );
    }

    const request = {
      body: cleanedMeasurements,
      query: {
        tenant: constants.DEFAULT_TENANT || "airqo",
      },
    };

    const responseFromInsertMeasurements = await createEventUtil.store(request);

    if (responseFromInsertMeasurements.success === false) {
      logger.error("KAFKA: failed to store the measurements");
      logger.error(
        `KAFKA: Error details: ${stringify(
          responseFromInsertMeasurements.errors
        )}`
      );
    } else if (responseFromInsertMeasurements.success === true) {
      logger.info("KAFKA: successfully stored the measurements");

      // Log deployment statistics if available
      if (responseFromInsertMeasurements.deployment_stats) {
        logger.info(
          `KAFKA: Deployment stats: ${stringify(
            responseFromInsertMeasurements.deployment_stats
          )}`
        );
      }
    }
  } catch (error) {
    logger.error(`🐛🐛 KAFKA: error message --- ${error.message}`);
    logger.error(`🐛🐛 KAFKA: full error object --- ${stringify(error)}`);
  }
};

// Transform the incoming forecast message to match the expected format
const transformForecastData = (forecastData) => {
  const {
    forecasts,
    created_at,
    model_version,
    device_id,
    site_id,
  } = forecastData;

  // Transform the forecasts into the expected format
  const values = forecasts.map((forecast) => ({
    time: forecast.timestamp,
    forecast_horizon: forecast.horizon,
    pm2_5: {
      value: forecast.measurements.pm2_5,
      confidence_lower: forecast.measurements.confidence.pm2_5_lower,
      confidence_upper: forecast.measurements.confidence.pm2_5_upper,
    },
    pm10: {
      value: forecast.measurements.pm10,
      confidence_lower: forecast.measurements.confidence.pm10_lower,
      confidence_upper: forecast.measurements.confidence.pm10_upper,
    },
  }));

  return {
    device_id,
    site_id,
    forecast_created_at: created_at,
    model_version,
    values,
  };
};

// New function to handle forecast messages
const consumeForecasts = async (messageData) => {
  try {
    if (isEmpty(messageData)) {
      logger.error(
        `KAFKA: forecast message is undefined --- ${stringify(messageData)}`
      );
      return;
    }

    const repairedJSONString = jsonrepair(messageData);
    const forecastData = JSON.parse(repairedJSONString);

    // Validate the incoming forecast data against our schema
    const options = {
      abortEarly: false,
    };

    const { error, value } = forecastSchema.validate(forecastData, options);

    if (error) {
      const errorDetails = error.details.map((detail) => ({
        message: detail.message,
        key: detail.context.key,
        path: detail.path.join("."),
      }));
      logger.error(`Forecast validation errors: ${stringify(errorDetails)}`);
      return;
    }

    // Transform the validated data to match the expected format for createForecastUtil
    const transformedData = transformForecastData(forecastData);

    // Create the request object expected by createForecastUtil.create
    const request = {
      body: transformedData,
      query: {
        tenant: constants.DEFAULT_TENANT,
      },
    };

    // Store the forecast using createForecastUtil
    const response = await createForecastUtil.create(request, (error) => {
      if (error) {
        logger.error(`KAFKA: forecast creation error --- ${stringify(error)}`);
        throw error;
      }
    });

    if (response.success === false) {
      logger.error(`KAFKA: failed to store forecasts --- ${response.message}`);
    } else if (response.success === true) {
      logText(`KAFKA: successfully stored forecasts --- ${response.message}`);
      logText(`KAFKA: stored ${response.data.length} forecast days`);
    }
  } catch (error) {
    logger.error(`🐛🐛 KAFKA: forecast error message --- ${error.message}`);
    logger.error(
      `🐛🐛 KAFKA: forecast full error object --- ${stringify(error)}`
    );
  }
};

const handleGroupCreated = async (payload) => {
  try {
    const { groupId, groupName, tenant } = payload;

    if (!groupId || !groupName || !tenant) {
      logger.error(
        `KAFKA-CONSUMER: Invalid group.created payload received: Missing required fields.`,
        payload
      );
      return;
    }

    // 1. Validate that the group actually exists in the auth-service
    let groupDetails;
    try {
      const response = await axios.get(
        `${constants.AUTH_SERVICE_URL}/groups/${groupId}`,
        {
          headers: { "x-api-key": constants.INTER_SERVICE_TOKEN },
          params: { tenant },
        }
      );
      groupDetails = response.data.data;
      if (isEmpty(groupDetails)) {
        logger.warn(
          `KAFKA-CONSUMER: Group with ID ${groupId} not found in auth-service for tenant ${tenant}. Skipping cohort creation.`
        );
        return;
      }
    } catch (error) {
      logger.error(
        `KAFKA-CONSUMER: Error fetching group details for ID ${groupId} from auth-service: ${error.message}`,
        payload
      );
      // Stop processing if we can't verify the group
      return;
    }

    const cohortName = `coh_group_${groupId}`;
    const cohortDescription = `Default cohort for organization: ${groupName}`;

    // 2. Check for idempotency: if a cohort with this name already exists, skip.
    const existingCohort = await CohortModel(tenant).findOne({
      name: cohortName,
    });

    if (existingCohort) {
      logger.warn(
        `KAFKA-CONSUMER: Cohort '${cohortName}' already exists for group ID ${groupId}. Skipping creation.`
      );
      return;
    }

    // 3. Create the default cohort
    // Derive network from group data, fall back to tenant if not present
    const network = groupDetails.network || tenant;

    await CohortModel(tenant).create({
      name: cohortName,
      description: cohortDescription,
      network: network,
      grp_id: groupId, // Link the cohort to the group
    });

    logger.info(
      `KAFKA-CONSUMER: Successfully created default cohort '${cohortName}' for group ID ${groupId} in network '${network}'.`
    );
  } catch (error) {
    logger.error(
      `KAFKA-CONSUMER: Error handling group.created event: ${error.message}`,
      payload
    );
  }
};

const handleNetworkEvents = async (messageData) => {
  try {
    const { action, value } = JSON.parse(messageData);
    const networkData = JSON.parse(value);

    const request = {
      query: { tenant: "airqo" }, // Assuming a default tenant
      body: networkData,
    };

    let response;

    switch (action) {
      case "create":
        logText("KAFKA-CONSUMER: Creating network in device-registry...");
        response = await createCohortUtil.createNetwork(request);
        break;
      case "update":
        logText("KAFKA-CONSUMER: Updating network in device-registry...");
        if (!networkData.net_name) {
          logger.error(
            `KAFKA-CONSUMER: Invalid message for network update - 'net_name' is missing.`
          );
          return;
        }
        request.query.name = networkData.net_name; // Use the unique network name
        response = await createCohortUtil.updateNetwork(request, (err) => {
          if (err) logger.error(`Error in updateNetwork callback: ${err}`);
        });
        break;
      case "delete":
        logText("KAFKA-CONSUMER: Deleting network from device-registry...");
        if (!networkData.net_name) {
          logger.error(
            `KAFKA-CONSUMER: Invalid message for network delete - 'net_name' is missing.`
          );
          return;
        }
        request.query.name = networkData.net_name; // Use the unique network name
        response = await createCohortUtil.deleteNetwork(request, (err) => {
          if (err) logger.error(`Error in deleteNetwork callback: ${err}`);
        });
        break;
      default:
        logger.warn(
          `KAFKA-CONSUMER: Unknown network action received: ${action}`
        );
        return;
    }

    if (response && response.success) {
      logger.info(
        `KAFKA-CONSUMER: Successfully processed network action '${action}' for network ID ${networkData._id}`
      );
    } else {
      logger.error(
        `KAFKA-CONSUMER: Failed to process network action '${action}' for network ID ${
          networkData._id
        }. Details: ${response ? response.message : "Unknown error"}`
      );
    }
  } catch (error) {
    logger.error(
      `🐛🐛 KAFKA-CONSUMER: Error processing network event: ${error.message}`
    );
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
      "hourly-measurements-topic": consumeHourlyMeasurements,
      "airqo.forecasts": consumeForecasts,
      [constants.GROUPS_TOPIC]: handleGroupCreated,
      [constants.NETWORK_EVENTS_TOPIC]: handleNetworkEvents,
    };

    await consumer.connect();

    // Subscribe to all topics
    await Promise.all(
      Object.keys(topicOperations).map((topic) =>
        consumer.subscribe({ topic, fromBeginning: false })
      )
    );

    // Start consuming messages
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const operation = topicOperations[topic];
          if (operation) {
            const messageData = message.value.toString();
            if (topic === constants.GROUPS_TOPIC) {
              const event = JSON.parse(messageData);
              if (event.type === "group.created") {
                await operation(event.payload);
              }
            } else {
              await operation(messageData);
            }
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
