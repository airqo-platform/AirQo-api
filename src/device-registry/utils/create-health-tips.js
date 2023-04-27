const HTTPStatus = require("http-status");
const HealthTipSchema = require("@models/HealthTips");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("./log");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-health-tip-util`
);

const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createHealthTips = {
  /*************** general ****************************** */
  list: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const filter = generateFilter.tips(request);

      const responseFromListHealthTips = await getModelByTenant(
        tenant,
        "healthtip",
        HealthTipSchema
      ).list({
        filter,
        limit,
        skip,
      });
      logObject("responseFromListHealthTips", responseFromListHealthTips);
      return responseFromListHealthTips;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  delete: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.tips(request);
      logObject("filter ", filter);
      const update = body;
      const opts = { new: true };
      const responseFromRemoveHealthTip = await getModelByTenant(
        tenant,
        "healthtip",
        HealthTipSchema
      ).remove({ filter });
      logObject("responseFromRemoveHealthTip", responseFromRemoveHealthTip);
      return responseFromRemoveHealthTip;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  update: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.tips(request);
      logObject("filter ", filter);
      const update = body;
      const opts = { new: true };
      const responseFromModifyHealthTip = await getModelByTenant(
        tenant,
        "healthtip",
        HealthTipSchema
      ).modify({ filter, update, opts });

      return responseFromModifyHealthTip;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
  create: async (request) => {
    try {
      let { body, query } = request;
      let { tenant } = query;
      let modifiedRequestBody = Object.assign({}, body);
      const responseFromRegisterHealthTip = await getModelByTenant(
        tenant,
        "healthtip",
        HealthTipSchema
      ).register(modifiedRequestBody);

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
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },
};

module.exports = createHealthTips;
