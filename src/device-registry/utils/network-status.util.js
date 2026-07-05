const httpStatus = require("http-status");
const NetworkStatusAlertModel = require("@models/NetworkStatusAlert");
const constants = require("@config/constants");
const { logObject, HttpError } = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-status-util`
);
const { Kafka } = require("kafkajs");
const isEmpty = require("is-empty");
const moment = require("moment-timezone");

const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

// Singleton Kafka producer instance
let kafkaProducer = null;
let isProducerConnected = false;

// Initialize Kafka producer
const initializeKafkaProducer = async () => {
  if (!kafkaProducer) {
    kafkaProducer = kafka.producer({
      groupId: constants.UNIQUE_PRODUCER_GROUP,
    });
  }

  if (!isProducerConnected) {
    try {
      await kafkaProducer.connect();
      isProducerConnected = true;
      //   logger.info("Kafka producer connected successfully");
    } catch (error) {
      logger.error(`📶📶 Failed to connect Kafka producer: ${error.message}`);
      throw error;
    }
  }

  return kafkaProducer;
};

// Graceful shutdown handler
const disconnectKafkaProducer = async () => {
  if (kafkaProducer && isProducerConnected) {
    try {
      await kafkaProducer.disconnect();
      isProducerConnected = false;
      //   logger.info("Kafka producer disconnected successfully");
    } catch (error) {
      logger.error(`📶📶 Error disconnecting Kafka producer: ${error.message}`);
    }
  }
};

// Handle graceful shutdown
process.on("SIGINT", disconnectKafkaProducer);
process.on("SIGTERM", disconnectKafkaProducer);

const networkStatusUtil = {
  createAlert: async ({ alertData, tenant = "airqo" } = {}, next) => {
    try {
      // Enrich alert data with time-based metadata
      const now = moment().tz(moment.tz.guess());

      const enrichedData = {
        ...alertData,
        alert_type: alertData.alert_type || "NETWORK_STATUS", // Default value
        tenant: tenant.toLowerCase(),
        environment: constants.ENVIRONMENT,
        day_of_week: now.day(),
        hour_of_day: now.hour(),
      };

      // Determine severity based on offline percentage
      if (alertData.not_transmitting_percentage >= 50) {
        enrichedData.severity = "HIGH";
      } else if (alertData.not_transmitting_percentage >= 35) {
        enrichedData.severity = "MEDIUM";
      } else {
        enrichedData.severity = "LOW";
      }

      const response = await NetworkStatusAlertModel(tenant).register(
        enrichedData,
        next
      );

      if (response && response.success) {
        try {
          const producer = await initializeKafkaProducer();
          await producer.send({
            topic: constants.NETWORK_STATUS_TOPIC || "network-status-alerts",
            messages: [
              {
                action: "create",
                value: JSON.stringify(response.data),
              },
            ],
          });
        } catch (error) {
          logger.error(`📶📶 Kafka error -- ${error.message}`);
          // Don't throw here - we don't want Kafka errors to affect the main flow
        }
      }

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

  list: async (request, next) => {
    try {
      const { query } = request;
      const {
        tenant,
        limit,
        skip,
        start_date,
        end_date,
        status,
        threshold_exceeded,
        network,
      } = query;

      const filter = {};

      if (start_date || end_date) {
        filter.checked_at = {};
        if (start_date) filter.checked_at.$gte = new Date(start_date);
        if (end_date) filter.checked_at.$lte = new Date(end_date);
      }

      if (status) {
        filter.status = status;
      }

      if (network) {
        filter.network_breakdown = {
          $elemMatch: { network: network.toLowerCase() },
        };
      }

      if (threshold_exceeded !== undefined) {
        filter.threshold_exceeded = threshold_exceeded === "true";
      }

      const response = await NetworkStatusAlertModel(tenant).list(
        {
          filter,
          limit: parseInt(limit) || 100,
          skip: parseInt(skip) || 0,
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

  getStatistics: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, start_date, end_date, network } = query;

      const filter = {};

      if (start_date || end_date) {
        filter.checked_at = {};
        if (start_date) filter.checked_at.$gte = new Date(start_date);
        if (end_date) filter.checked_at.$lte = new Date(end_date);
      }

      if (network) {
        const response = await NetworkStatusAlertModel(
          tenant
        ).getStatisticsByNetwork({ filter, network }, next);
        return response;
      }

      const response = await NetworkStatusAlertModel(tenant).getStatistics(
        { filter },
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

  getHourlyTrends: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, start_date, end_date, network } = query;

      const filter = {};

      if (start_date || end_date) {
        filter.checked_at = {};
        if (start_date) filter.checked_at.$gte = new Date(start_date);
        if (end_date) filter.checked_at.$lte = new Date(end_date);
      }

      if (network) {
        const response = await NetworkStatusAlertModel(
          tenant
        ).getHourlyTrendsByNetwork({ filter, network }, next);
        return response;
      }

      const response = await NetworkStatusAlertModel(tenant).getHourlyTrends(
        { filter },
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

  getRecentAlerts: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, hours = 24, network } = query;

      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const filter = { checked_at: { $gte: cutoff } };

      if (network) {
        filter.network_breakdown = {
          $elemMatch: {
            network: network.toLowerCase(),
            not_transmitting_percentage: { $gte: 35 },
          },
        };
      } else {
        filter.threshold_exceeded = true;
      }

      const response = await NetworkStatusAlertModel(tenant).list(
        {
          filter,
          limit: 50,
          skip: 0,
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

  getUptimeSummary: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, days = 7, network } = query;

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const filter = { checked_at: { $gte: startDate } };

      if (network) {
        const response = await NetworkStatusAlertModel(
          tenant
        ).getUptimeSummaryByNetwork({ filter, network }, next);
        return response;
      }

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$checked_at" },
            },
            avgOfflinePercentage: { $avg: "$not_transmitting_percentage" },
            maxOfflinePercentage: { $max: "$not_transmitting_percentage" },
            minOfflinePercentage: { $min: "$not_transmitting_percentage" },
            totalChecks: { $sum: 1 },
            alertsTriggered: {
              $sum: { $cond: ["$threshold_exceeded", 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const response = await NetworkStatusAlertModel(tenant).executeAggregation(
        { pipeline },
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

  getNetworkBreakdown: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, start_date, end_date } = query;

      const filter = {};

      if (start_date || end_date) {
        filter.checked_at = {};
        if (start_date) filter.checked_at.$gte = new Date(start_date);
        if (end_date) filter.checked_at.$lte = new Date(end_date);
      }

      const response = await NetworkStatusAlertModel(
        tenant
      ).getStatisticsByNetwork({ filter }, next);

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

module.exports = networkStatusUtil;
