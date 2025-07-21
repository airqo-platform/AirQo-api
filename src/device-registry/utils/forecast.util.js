const httpStatus = require("http-status");
const ForecastModel = require("@models/Forecast");
const constants = require("@config/constants");
const { logObject, HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- forecast-util`);
const { Kafka } = require("kafkajs");
const isEmpty = require("is-empty");

const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const processValues = (values, forecast_created_at) => {
  const processedValues = values.map((value) => ({
    ...value,
    forecast_created_at,
  }));

  // Group values by day and create day-specific records
  const dayGroups = processedValues.reduce((acc, value) => {
    const day = value.time.split("T")[0];
    if (!acc[day]) {
      acc[day] = [];
    }
    acc[day].push(value);
    return acc;
  }, {});

  return Object.entries(dayGroups).map(([day, dayValues]) => ({
    day,
    values: dayValues,
    first: dayValues[0].time,
    last: dayValues[dayValues.length - 1].time,
  }));
};

const forecastUtils = {
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const {
        device_id,
        site_id,
        forecast_created_at,
        model_version,
        values,
      } = body;

      // Process values into day-grouped format
      const forecastDays = processValues(values, forecast_created_at);

      // Create multiple forecast records, one per day
      const createPromises = forecastDays.map(async (dayForecast) => {
        const forecastData = {
          device_id,
          site_id,
          day: dayForecast.day,
          first: dayForecast.first,
          last: dayForecast.last,
          values: dayForecast.values.map((value) => ({
            ...value,
            device_id,
            site_id,
            model_version,
          })),
        };

        return ForecastModel(tenant).register(forecastData, next);
      });

      const results = await Promise.all(createPromises);
      const successfulResults = results.filter((result) => result.success);

      if (successfulResults.length > 0) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.FORECASTS_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(successfulResults.map((r) => r.data)),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return {
          success: true,
          message: "Successfully created forecasts",
          data: successfulResults.map((r) => r.data),
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create forecasts",
          errors: { message: "No forecasts were created successfully" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  listByDevice: async (request, next) => {
    try {
      const { params, query } = request;
      const { tenant, limit, skip, start_date, end_date } = query;
      const { deviceId } = params;

      const filter = {
        device_id: deviceId,
      };

      if (start_date || end_date) {
        filter.day = {};
        if (start_date) filter.day.$gte = start_date.split("T")[0];
        if (end_date) filter.day.$lte = end_date.split("T")[0];
      }

      const response = await ForecastModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  listBySite: async (request, next) => {
    try {
      const { params, query } = request;
      const { tenant, limit, skip, start_date, end_date } = query;
      const { siteId } = params;

      const filter = {
        site_id: siteId,
      };

      if (start_date || end_date) {
        filter.day = {};
        if (start_date) filter.day.$gte = start_date.split("T")[0];
        if (end_date) filter.day.$lte = end_date.split("T")[0];
      }

      const response = await ForecastModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = forecastUtils;
