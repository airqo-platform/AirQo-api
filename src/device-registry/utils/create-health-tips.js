const httpStatus = require("http-status");
const HealthTipModel = require("@models/HealthTips");
const constants = require("@config/constants");
const { logObject } = require("./log");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-health-tip-util`
);
const translateUtil = require("./translate");
const { HttpError } = require("@utils/errors");
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createHealthTips = {
  /*************** general ****************************** */
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.tips(request, next);
      const language = request.query.language;
      let translatedHealthTips;

      let responseFromListHealthTips = await HealthTipModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      if (language !== undefined) {
        translatedHealthTips = await translateUtil.translateTips(
          {
            healthTips: responseFromListHealthTips.data,
            targetLanguage: language,
          },
          next
        );
        responseFromListHealthTips = translatedHealthTips;
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
