const LocationModel = require("@models/Location");
const { logObject } = require("./log");
const axios = require("axios");
const httpStatus = require("http-status");
const axiosInstance = () => {
  return axios.create();
};
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- create-location-util`
);
const { HttpError } = require("@utils/errors");
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
    } catch (error) {
      logger.error(
        `internal server error -- hasNoWhiteSpace -- ${error.message}`
      );
    }
  },
  create: async (request, next) => {
    try {
      let { body } = request;
      let { tenant } = request.query;
      logObject("body", body);

      const responseFromRegisterLocation = await LocationModel(tenant).register(
        body,
        next
      );

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
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      let { query } = request;
      let { body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.locations(request, next);

      const responseFromModifyLocation = await LocationModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );

      return responseFromModifyLocation;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.locations(request, next);
      const responseFromRemoveLocation = await LocationModel(tenant).remove(
        {
          filter,
        },
        next
      );

      return responseFromRemoveLocation;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      let { query } = request;
      let { tenant, limit, skip } = query;
      let filter = generateFilter.locations(request, next);

      const responseFromListLocation = await LocationModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );

      return responseFromListLocation;
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

module.exports = createLocation;
