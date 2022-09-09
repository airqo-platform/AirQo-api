const LocationSchema = require("../models/Location");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const axios = require("axios");
const HTTPStatus = require("http-status");
const axiosInstance = () => {
  return axios.create();
};
const constants = require("../config/constants");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-location-util`
);
const { kafkaProducer } = require("../config/kafkajs");

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
          await kafkaProducer.send({
            topic: constants.LOCATIONS_TOPIC,
            messages: [
              {
                action: "create",
                value: JSON.stringify(responseFromRegisterLocation.data),
              },
            ],
          });
        } catch (error) {
          logger.error(`internal server error -- ${error.message}`);
        }

        return {
          success: true,
          message: responseFromRegisterLocation.message,
          data: responseFromRegisterLocation.data,
          status,
        };
      }

      if (responseFromRegisterLocation.success === false) {
        let errors = responseFromRegisterLocation.errors
          ? responseFromRegisterLocation.errors
          : "";

        let status = responseFromRegisterLocation.status
          ? responseFromRegisterLocation.status
          : "";

        return {
          success: false,
          message: responseFromRegisterLocation.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to create location",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
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

      if (responseFromModifyLocation.success === true) {
        let status = responseFromModifyLocation.status
          ? responseFromModifyLocation.status
          : "";
        return {
          success: true,
          message: responseFromModifyLocation.message,
          data: responseFromModifyLocation.data,
          status,
        };
      }

      if (responseFromModifyLocation.success === false) {
        let errors = responseFromModifyLocation.errors
          ? responseFromModifyLocation.errors
          : "";

        let status = responseFromModifyLocation.status
          ? responseFromModifyLocation.status
          : "";

        return {
          success: false,
          message: responseFromModifyLocation.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to update location",
        errors: err.message,
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

      if (responseFromRemoveLocation.success === true) {
        let status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : "";
        return {
          success: true,
          message: responseFromRemoveLocation.message,
          data: responseFromRemoveLocation.data,
          status,
        };
      }

      if (responseFromRemoveLocation.success === false) {
        let errors = responseFromRemoveLocation.errors
          ? responseFromRemoveLocation.errors
          : "";

        let status = responseFromRemoveLocation.status
          ? responseFromRemoveLocation.status
          : "";

        return {
          success: false,
          message: responseFromRemoveLocation.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "unable to delete location",
        errors: err.message,
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
      logObject("location filter", filter);

      let responseFromListLocation = await getModelByTenant(
        tenant.toLowerCase(),
        "location",
        LocationSchema
      ).list({
        filter,
        limit,
        skip,
      });

      logObject("responseFromListLocation", responseFromListLocation);
      if (responseFromListLocation.success === false) {
        let errors = responseFromListLocation.errors
          ? responseFromListLocation.errors
          : "";

        let status = responseFromListLocation.status
          ? responseFromListLocation.status
          : "";
        return {
          success: false,
          message: responseFromListLocation.message,
          errors,
          status,
        };
      }

      if (responseFromListLocation.success === true) {
        let status = responseFromListLocation.status
          ? responseFromListLocation.status
          : "";
        data = responseFromListLocation.data;
        return {
          success: true,
          message: responseFromListLocation.message,
          data,
          status,
        };
      }
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
