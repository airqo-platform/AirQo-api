const AirQloudSchema = require("../models/Airqloud");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const { getModelByTenant } = require("./multitenancy");
const isEmpty = require("is-empty");
const jsonify = require("./jsonify");
const axios = require("axios");
const HTTPStatus = require("http-status");
const axiosInstance = () => {
  return axios.create();
};
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger("create-airqloud-util");
const createLocationUtil = require("./create-location");

const createAirqloud = {
  initialIsCapital: (word) => {
    return word[0] !== word[0].toLowerCase();
  },
  hasNoWhiteSpace: (word) => {
    try {
      const hasWhiteSpace = word.indexOf(" ") >= 0;
      return !hasWhiteSpace;
    } catch (e) {
      logger.error(
        `create AirQloud util server error -- hasNoWhiteSpace -- ${e.message}`
      );
    }
  },
  retrieveLocationCoordinates: async (request) => {
    try {
      const responseFromListLocation = await createLocationUtil.list(request);
      logObject(
        "responseFromListLocation in AirQloud util",
        responseFromListLocation
      );

      if (responseFromListLocation.success === true) {
        if (isEmpty(responseFromListLocation.data)) {
          return {
            success: false,
            message: "unable to retrieve location details",
            status: HTTPStatus.NOT_FOUND,
            errors: {
              message: "no record exists for this location_id",
            },
          };
        }
        if (responseFromListLocation.data.length === 1) {
          const data = responseFromListLocation.data[0];
          return {
            data: data.location,
            success: true,
            message: "retrieved the location",
            status: HTTPStatus.OK,
          };
        }
        if (responseFromListLocation.data.length > 1) {
          return {
            success: false,
            message: "unable to retrieve location details",
            status: HTTPStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message: "requested for one record but received many",
            },
          };
        }
      }

      if (responseFromListLocation.success === false) {
        return {
          success: false,
          message: "unable to retrieve details from the provided location_id",
          errors: responseFromListLocation.errors,
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (request) => {
    try {
      const { body } = request;
      const { tenant } = request.query;
      const { location_id } = request.body;
      logObject("body", body);
      let modifiedBody = body;
      if (!isEmpty(location_id)) {
        let locationRequest = {};
        locationRequest["query"] = {};
        locationRequest["query"]["id"] = body.location_id;
        locationRequest["query"]["tenant"] = tenant;
        logObject("locationRequest", locationRequest);
        let responseFromRetrieveLocationCoordinates = await createAirqloud.retrieveLocationCoordinates(
          locationRequest
        );
        logObject(
          "responseFromRetrieveLocationCoordinates",
          responseFromRetrieveLocationCoordinates
        );
        if (responseFromRetrieveLocationCoordinates.success === true) {
          modifiedBody["location"] =
            responseFromRetrieveLocationCoordinates.data;
        }
        if (responseFromRetrieveLocationCoordinates.success === false) {
          return responseFromRetrieveLocationCoordinates;
        }
      }

      const responseFromRegisterAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).register(modifiedBody);

      logObject("responseFromRegisterAirQloud", responseFromRegisterAirQloud);

      if (responseFromRegisterAirQloud.success === true) {
        let status = responseFromRegisterAirQloud.status
          ? responseFromRegisterAirQloud.status
          : "";
        return {
          success: true,
          message: responseFromRegisterAirQloud.message,
          data: responseFromRegisterAirQloud.data,
          status,
        };
      }

      if (responseFromRegisterAirQloud.success === false) {
        let errors = responseFromRegisterAirQloud.errors
          ? responseFromRegisterAirQloud.errors
          : "";

        let status = responseFromRegisterAirQloud.status
          ? responseFromRegisterAirQloud.status
          : "";

        return {
          success: false,
          message: responseFromRegisterAirQloud.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement(" the util server error,", err.message);
      return {
        success: false,
        message: "unable to create airqloud",
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
      let filter = generateFilter.airqlouds(request);

      let responseFromModifyAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyAirQloud.success === true) {
        let status = responseFromModifyAirQloud.status
          ? responseFromModifyAirQloud.status
          : "";
        return {
          success: true,
          message: responseFromModifyAirQloud.message,
          data: responseFromModifyAirQloud.data,
          status,
        };
      }

      if (responseFromModifyAirQloud.success === false) {
        let errors = responseFromModifyAirQloud.errors
          ? responseFromModifyAirQloud.errors
          : "";

        let status = responseFromModifyAirQloud.status
          ? responseFromModifyAirQloud.status
          : "";

        return {
          success: false,
          message: responseFromModifyAirQloud.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("update AirQlouds util", err.message);
      return {
        success: false,
        message: "unable to update airqloud",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.airqlouds(request);
      let responseFromRemoveAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).remove({
        filter,
      });

      if (responseFromRemoveAirQloud.success === true) {
        let status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : "";
        return {
          success: true,
          message: responseFromRemoveAirQloud.message,
          data: responseFromRemoveAirQloud.data,
          status,
        };
      }

      if (responseFromRemoveAirQloud.success === false) {
        let errors = responseFromRemoveAirQloud.errors
          ? responseFromRemoveAirQloud.errors
          : "";

        let status = responseFromRemoveAirQloud.status
          ? responseFromRemoveAirQloud.status
          : "";

        return {
          success: false,
          message: responseFromRemoveAirQloud.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("delete AirQloud util", err.message);
      return {
        success: false,
        message: "unable to delete airqloud",
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
      let filter = generateFilter.airqlouds(request);
      logObject("filter", filter);

      let responseFromListAirQloud = await getModelByTenant(
        tenant.toLowerCase(),
        "airqloud",
        AirQloudSchema
      ).list({
        filter,
        limit,
        skip,
      });

      logObject("responseFromListAirQloud", responseFromListAirQloud);
      if (responseFromListAirQloud.success === false) {
        let errors = responseFromListAirQloud.errors
          ? responseFromListAirQloud.errors
          : "";

        let status = responseFromListAirQloud.status
          ? responseFromListAirQloud.status
          : "";
        return {
          success: false,
          message: responseFromListAirQloud.message,
          errors,
          status,
        };
      }

      if (responseFromListAirQloud.success === true) {
        let status = responseFromListAirQloud.status
          ? responseFromListAirQloud.status
          : "";
        data = responseFromListAirQloud.data;
        return {
          success: true,
          message: responseFromListAirQloud.message,
          data,
          status,
        };
      }
    } catch (err) {
      logElement("list AirQlouds util", err.message);
      return {
        success: false,
        message: "unable to list airqloud",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createAirqloud;
