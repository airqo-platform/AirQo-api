const httpStatus = require("http-status");
const HealthTipModel = require("@models/HealthTips");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} --  health-tip-util`);
const { translate, generateFilter } = require("@utils/common");
const { logObject, HttpError } = require("@utils/shared");
const { Kafka } = require("kafkajs");
const isEmpty = require("is-empty");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createHealthTips = {
  /*************** general ****************************** */
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip, path } = query;
      const filter = generateFilter.tips(request, next);
      if (!isEmpty(path)) {
        filter.path = path;
      }
      const language = request.query.language;

      const _skip = parseInt(skip, 10) || 0;
      const _limit = parseInt(limit, 10) || 1000;

      const pipeline = [
        { $match: filter },
        {
          $facet: {
            paginatedResults: [
              { $sort: { createdAt: -1 } },
              { $skip: _skip },
              { $limit: _limit },
            ],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const results = await HealthTipModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      const paginatedResults = results[0].paginatedResults;
      const total = results[0].totalCount[0]
        ? results[0].totalCount[0].count
        : 0;

      let responseFromListHealthTips = {
        success: true,
        message: "Successfully retrieved health tips",
        data: paginatedResults,
        status: httpStatus.OK,
        meta: {
          total,
          limit: _limit,
          skip: _skip,
          page: Math.floor(_skip / _limit) + 1,
          totalPages: Math.ceil(total / _limit),
        },
      };

      if (
        language !== undefined &&
        !isEmpty(responseFromListHealthTips) &&
        !isEmpty(responseFromListHealthTips.data)
      ) {
        const translatedHealthTips = await translate.translateTips(
          {
            healthTips: responseFromListHealthTips.data,
            targetLanguage: language,
          },
          next
        );
        if (translatedHealthTips.success === true) {
          responseFromListHealthTips.data = translatedHealthTips.data;
        }
      }

      logObject("responseFromListHealthTips", responseFromListHealthTips);
      return responseFromListHealthTips;
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
  bulkUpdate: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const updates = body.updates;

      const responseFromBulkModifyHealthTip = await HealthTipModel(
        tenant
      ).bulkModify(updates, next);

      return responseFromBulkModifyHealthTip;
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
  removeInvalidTips: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const responseFromRemoveInvalidTips = await HealthTipModel(
        tenant
      ).removeInvalidTips(next);

      return responseFromRemoveInvalidTips;
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
  delete: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.tips(request, next);
      logObject("filter ", filter);
      const update = body;
      const opts = { new: true };
      const responseFromRemoveHealthTip = await HealthTipModel(tenant).remove(
        {
          filter,
        },
        next
      );
      logObject("responseFromRemoveHealthTip", responseFromRemoveHealthTip);
      return responseFromRemoveHealthTip;
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
  update: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.tips(request, next);
      logObject("filter ", filter);
      const update = body;
      const opts = { new: true };
      const responseFromModifyHealthTip = await HealthTipModel(tenant).modify(
        {
          filter,
          update,
          opts,
        },
        next
      );

      return responseFromModifyHealthTip;
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
  create: async (request, next) => {
    try {
      let { body, query } = request;
      let { tenant } = query;
      let modifiedRequestBody = Object.assign({}, body);
      const responseFromRegisterHealthTip = await HealthTipModel(
        tenant
      ).register(modifiedRequestBody, next);

      logObject("responseFromRegisterHealthTip", responseFromRegisterHealthTip);

      if (responseFromRegisterHealthTip.success === true) {
        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.TIPS_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterHealthTip.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterHealthTip;
      } else if (responseFromRegisterHealthTip.success === false) {
        return responseFromRegisterHealthTip;
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
};

module.exports = createHealthTips;
