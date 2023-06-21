const LocationSchema = require("@models/Location");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("@config/database");
const isEmpty = require("is-empty");
const axios = require("axios");
const HTTPStatus = require("http-status");
const axiosInstance = () => {
  return axios.create();
};
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-location-util`
);

const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const createLocation = {
  initialIsCapital: (word) => {
    return word[0] !== word[0].toLowerCase();
  },
  hasNoWhiteSpace: (word) => {
    try {
      const hasWhiteSpace = word.indexOf(" ") >= 0;
      return !hasWhiteSpace;
    } catch (e) {
      logger.error(`internal server error -- hasNoWhiteSpace -- ${e.message}`);
    }
  },
  create: async (request) => {
    try {
      let { body } = request;
      let { tenant } = request.query;
      logObject("body", body);

      let responseFromRegisterLocation = await getModelByTenant(
        tenant.toLowerCase(),
        "location",
        LocationSchema
      ).register(body);

      logObject("responseFromRegisterLocation", responseFromRegisterLocation);

      if (responseFromRegisterLocation.success === true) {
        let status = responseFromRegisterLocation.status
          ? responseFromRegisterLocation.status
          : "";

        try {
          const kafkaProducer = kafka.producer({
            groupId: constants.UNIQUE_PRODUCER_GROUP,
          });
          await kafkaProducer.connect();
          await kafkaProducer.send({
            topic: constants.LOCATIONS_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterLocation.data),
              },
            ],
          });
          await kafkaProducer.disconnect();
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return responseFromRegisterLocation;
      } else if (responseFromRegisterLocation.success === false) {
        return responseFromRegisterLocation;
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to create location",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: err.message },
      };
    }
  },
  update: async (request) => {
    try {
      let { query } = request;
      let { body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.locations(request);

      let responseFromModifyLocation = await getModelByTenant(
        tenant.toLowerCase(),
        "location",
        LocationSchema
      ).modify({
        filter,
        update,
      });

      return responseFromModifyLocation;
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to update location",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.locations(request);
      let responseFromRemoveLocation = await getModelByTenant(
        tenant.toLowerCase(),
        "location",
        LocationSchema
      ).remove({
        filter,
      });

      return responseFromRemoveLocation;
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to delete location",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;
      let filter = generateFilter.locations(request);

      const responseFromListLocation = await getModelByTenant(
        tenant.toLowerCase(),
        "location",
        LocationSchema
      ).list({
        filter,
        limit,
        skip,
      });

      return responseFromListLocation;
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to list location",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createLocation;
