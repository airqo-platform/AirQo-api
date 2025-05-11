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

const networkStatusUtil = {
  createAlert: async ({ alertData, tenant = "airqo" } = {}, next) => {
    try {
      // Enrich alert data with time-based metadata
      const now = moment().tz(moment.tz.guess());

      const enrichedData = {
        ...alertData,
        tenant: tenant.toLowerCase(),
        environment: constants.ENVIRONMENT,
        day_of_week: now.day(),
        hour_of_day: now.hour(),
      };

      // Determine severity based on offline percentage
      if (alertData.offline_percentage >= 50) {
        enrichedData.severity = "HIGH";
      } else if (alertData.offline_percentage >= 35) {
        enrichedData.severity = "MEDIUM";
      } else {
        enrichedData.severity = "LOW";
      }

      const response = await NetworkStatusAlertModel(tenant).register(
        enrichedData,
        next
      );

      if (response.success) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.NETWORK_STATUS_TOPIC || "network-status-alerts",
            messages: [
              {
                action: "create",
                value: JSON.stringify(response.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`Kafka error -- ${error.message}`);
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
      const { tenant, start_date, end_date } = query;

      const filter = {};

      if (start_date || end_date) {
        filter.checked_at = {};
        if (start_date) filter.checked_at.$gte = new Date(start_date);
        if (end_date) filter.checked_at.$lte = new Date(end_date);
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
      const { tenant, start_date, end_date } = query;

      const filter = {};

      if (start_date || end_date) {
        filter.checked_at = {};
        if (start_date) filter.checked_at.$gte = new Date(start_date);
        if (end_date) filter.checked_at.$lte = new Date(end_date);
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
      const { tenant, hours = 24 } = query;

      const filter = {
        checked_at: {
          $gte: new Date(Date.now() - hours * 60 * 60 * 1000),
        },
        threshold_exceeded: true,
      };

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
      const { tenant, days = 7 } = query;

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const pipeline = [
        {
          $match: {
            checked_at: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$checked_at" },
            },
            avgOfflinePercentage: { $avg: "$offline_percentage" },
            maxOfflinePercentage: { $max: "$offline_percentage" },
            minOfflinePercentage: { $min: "$offline_percentage" },
            totalChecks: { $sum: 1 },
            alertsTriggered: {
              $sum: { $cond: ["$threshold_exceeded", 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const response = await NetworkStatusAlertModel(tenant).aggregate(
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
};

module.exports = networkStatusUtil;
