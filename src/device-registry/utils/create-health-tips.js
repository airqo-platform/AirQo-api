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
      const filter = generateFilter.photos(request);

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
      const filter = generateFilter.photos(request);
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
      const filter = generateFilter.photos(request);
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
      let { image_url, device_name, device_id } = body;
      let requestForImageIdExtraction = {};
      requestForImageIdExtraction["body"] = {};
      requestForImageIdExtraction["query"] = {};
      requestForImageIdExtraction["query"]["device_name"] = device_name;
      requestForImageIdExtraction["query"]["device_id"] = device_id;
      requestForImageIdExtraction["body"]["image_urls"] = [];
      requestForImageIdExtraction["body"]["image_urls"].push(image_url);
      const responseFromExtractImage = await createHealthTips.extractImageIds(
        requestForImageIdExtraction
      );
      let photoId = [];
      let modifiedRequestBody = body;
      if (responseFromExtractImage.success === true) {
        photoId = responseFromExtractImage.data;
        logObject("photoId", photoId);
        modifiedRequestBody["image_code"] = photoId[0];
        modifiedRequestBody["metadata"] = {};
        modifiedRequestBody["metadata"]["public_id"] = photoId[0];
        modifiedRequestBody["metadata"]["url"] = image_url;
      } else if (responseFromExtractImage.success === false) {
        logObject("responseFromExtractImage", responseFromExtractImage);
        return responseFromExtractImage;
      }

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
            topic: constants.PHOTOS_TOPIC,
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

        return {
          success: true,
          message: responseFromRegisterHealthTip.message,
          status: responseFromRegisterHealthTip.status
            ? responseFromRegisterHealthTip.status
            : "",
          data: responseFromRegisterHealthTip.data,
        };
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
