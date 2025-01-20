const axios = require("axios");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const redis = require("@config/redis");
const { generateDateFormatWithoutHrs, isDate } = require("@utils/date");
const cleanDeep = require("clean-deep");
const HTTPStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-feed-util`);

const createFeed = {
  isGasDevice: (description) => {
    return description.toLowerCase().includes("gas");
  },

  categorizeOutput: (input) => {
    try {
      if (!input || typeof input !== "object") {
        throw new Error("Invalid input: expected an object");
      }

      if (!input.hasOwnProperty("description")) {
        return "lowcost";
      }

      return createFeed.isGasDevice(input.description) ? "gas" : "lowcost";
    } catch (error) {
      return {
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  getAPIKey: async (channel) => {
    try {
      const tenant = "airqo";
      const url = constants.GET_DEVICES_URL({ tenant, channel });

      const response = await axios.get(url, {
        headers: {
          Authorization: `JWT ${constants.JWT_TOKEN}`,
        },
      });

      const responseJSON = response.data;

      if (!responseJSON.success) {
        return {
          success: false,
          message: responseJSON.message || "Error retrieving device details",
          errors: responseJSON.errors || { message: "Internal server errors" },
        };
      }

      const deviceDetails = responseJSON.devices[0];

      if (isEmpty(deviceDetails)) {
        return {
          success: false,
          message: "Device does not exist",
          status: HTTPStatus.NOT_FOUND,
        };
      }

      if (isEmpty(deviceDetails.readKey)) {
        return {
          success: false,
          message: "ReadKey unavailable, this might be an external device",
          status: HTTPStatus.NOT_FOUND,
        };
      }

      const decryptResponse = await axios.post(
        constants.DECRYPT_DEVICE_KEY_URL,
        { encrypted_key: deviceDetails.readKey },
        {
          headers: {
            Authorization: `JWT ${constants.JWT_TOKEN}`,
          },
        }
      );

      return {
        success: true,
        data: decryptResponse.data.decrypted_key,
        message: "Read key successfully retrieved",
      };
    } catch (error) {
      logger.error("Error in getAPIKey:", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "an unexpected error occurred" },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  fetchThingspeakData: async (request) => {
    const url = createFeed.readRecentDeviceMeasurementsFromThingspeak({
      request,
    });
    const response = await axios.get(url);
    return response.data;
  },

  handleThingspeakResponse: (data) => {
    const readings = data.feeds[0];
    if (isEmpty(readings)) {
      return {
        status: HTTPStatus.NOT_FOUND,
        data: {
          success: true,
          message: "No recent measurements for this device",
        },
      };
    }
    return { status: HTTPStatus.OK, data: { isCache: false, ...readings } };
  },

  processDeviceMeasurements: async (readings, metadata) => {
    if (isEmpty(readings)) {
      return {
        status: HTTPStatus.NOT_FOUND,
        data: {
          success: true,
          message: "no recent measurements for this device",
        },
      };
    }

    let cleanedDeviceMeasurements = createFeed.clean(readings);
    const fieldOneValue = cleanedDeviceMeasurements.field1 || null;

    if (isEmpty(fieldOneValue)) {
      return {
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        data: {
          success: false,
          message: "unable to categorise device",
          errors: {
            message:
              "please crosscheck device on thingSpeak, it is not sending field1",
          },
        },
      };
    }

    const deviceCategory = isDate(fieldOneValue)
      ? "reference"
      : createFeed.categorizeOutput(metadata);
    cleanedDeviceMeasurements.field9 = deviceCategory;

    let transformedData = await createFeed.transformMeasurement(
      cleanedDeviceMeasurements
    );
    let transformedField = {};

    if (transformedData.other_data) {
      transformedField = await createFeed.trasformFieldValues({
        otherData: transformedData.other_data,
        deviceCategory,
      });
      delete transformedData.other_data;
    }

    let cleanedFinalTransformation = createFeed.clean({
      ...transformedData,
      ...transformedField,
    });

    if (cleanedFinalTransformation.ExternalPressure) {
      const pressureConversionResult = createFeed.convertFromHectopascalsToKilopascals(
        cleanedFinalTransformation.ExternalPressure
      );
      if (pressureConversionResult.success) {
        cleanedFinalTransformation.ExternalPressure =
          pressureConversionResult.data;
      } else {
        return {
          status:
            pressureConversionResult.status || HTTPStatus.INTERNAL_SERVER_ERROR,
          data: pressureConversionResult,
        };
      }
    }

    return {
      status: HTTPStatus.OK,
      data: { isCache: false, ...cleanedFinalTransformation },
    };
  },
  readRecentDeviceMeasurementsFromThingspeak: ({ request } = {}) => {
    try {
      logObject("the request", request);
      const { channel, api_key, start, end, path } = request;
      if (isEmpty(start) && !isEmpty(end)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}&end=${end}`;
      } else if (isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}&start=${start}`;
      } else if (!isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}&start=${start}&end=${end}`;
      } else if (!isEmpty(path) && path === "last") {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}`;
      } else {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?results=1&metadata=true&api_key=${api_key}`;
      }
    } catch (error) {
      logElement(
        "the error for generating urls of getting Thingspeak feeds",
        error.message
      );
    }
  },
  clean: (obj) => {
    logObject("the obj", obj);
    let trimmedValues = Object.entries(obj).reduce((acc, [key, value]) => {
      acc[key] = typeof value === "string" ? value.trim() : value;
      return acc;
    }, {});

    for (var propName in trimmedValues) {
      if (
        trimmedValues[propName] === null ||
        trimmedValues[propName] === undefined
      ) {
        delete trimmedValues[propName];
      }

      if (trimmedValues["created_at"]) {
        let date = new Date(trimmedValues["created_at"]);
        if (isNaN(date)) {
          delete trimmedValues["created_at"];
        }
      }

      if (isNaN(trimmedValues["pm10"])) {
        //   delete trimmedValues["pm10"];
      }

      if (trimmedValues["pm2_5"]) {
      }

      if (trimmedValues["s2_pm10"]) {
      }

      if (trimmedValues["s2_pm2_5"]) {
      }
    }
    return trimmedValues;
  },
  getAPIKey: async (channel) => {
    try {
      const tenant = "airqo";
      const url = constants.GET_DEVICES_URL({ tenant, channel });

      const response = await axios.get(url, {
        headers: {
          Authorization: `JWT ${constants.JWT_TOKEN}`,
        },
      });

      const responseJSON = response.data;

      if (!responseJSON.success) {
        return {
          success: false,
          message: responseJSON.message || "Error retrieving device details",
          errors: responseJSON.errors || { message: "Internal server errors" },
        };
      }

      const deviceDetails = responseJSON.devices[0];

      if (isEmpty(deviceDetails)) {
        return {
          success: false,
          message: "Device does not exist",
          status: HTTPStatus.NOT_FOUND,
        };
      }

      if (isEmpty(deviceDetails.readKey)) {
        return {
          success: false,
          message: "ReadKey unavailable, this might be an external device",
          status: HTTPStatus.NOT_FOUND,
        };
      }

      const decryptResponse = await axios.post(
        constants.DECRYPT_DEVICE_KEY_URL,
        { encrypted_key: deviceDetails.readKey },
        {
          headers: {
            Authorization: `JWT ${constants.JWT_TOKEN}`,
          },
        }
      );

      return {
        success: true,
        data: decryptResponse.data.decrypted_key,
        message: "Read key successfully retrieved",
      };
    } catch (error) {
      logger.error("Error in getAPIKey:", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "an unexpected error occurred" },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  getFieldLabel: (field) => {
    try {
      return constants.FIELDS_AND_LABELS[field];
    } catch (error) {
      logElement("the getFieldLabel error", error.message);
    }
  },
  getBamFieldLabel: (field) => {
    try {
      return constants.BAM_FIELDS_AND_LABELS[field];
    } catch (error) {
      logElement("the getBamFieldLabel error", error.message);
    }
  },
  getGasFieldLabel: (field) => {
    try {
      return constants.THINGSPEAK_GAS_FIELD_DESCRIPTIONS[field];
    } catch (error) {
      logElement("the getGasFieldLabel error", error.message);
    }
  },
  getPositionLabel: ({ position = "", deviceCategory = "" } = {}) => {
    try {
      if (deviceCategory === "lowcost") {
        return constants.POSITIONS_AND_LABELS[position];
      } else if (deviceCategory === "reference") {
        return constants.BAM_POSITIONS_AND_LABELS[position];
      } else if (deviceCategory === "gas") {
        return constants.GAS_POSITIONS_AND_LABELS[position];
      } else {
        return {};
      }
    } catch (error) {
      logElement("the getPositionLabel error", error.message);
    }
  },
  getValuesFromString: (stringValues) => {
    try {
      arrayValues = stringValues.split(",");
      return arrayValues;
    } catch (error) {
      logElement("the getValuesFromString error", error.message);
    }
  },
  trasformFieldValues: async ({ otherData = "", deviceCategory = "" } = {}) => {
    try {
      let arrayValues = createFeed.getValuesFromString(otherData);
      let newObj = await Object.entries(arrayValues).reduce(
        (newObj, [position, value]) => {
          if (value) {
            let transformedPosition = createFeed.getPositionLabel({
              position,
              deviceCategory,
            });

            return { ...newObj, [transformedPosition]: value.trim() };
          }
        },
        {}
      );
      return cleanDeep(newObj);
    } catch (e) {
      logElement("the trasformFieldValues error", e.message);
    }
  },
  transformMeasurement: (measurement) => {
    try {
      const deviceCategory = measurement.field9
        ? measurement.field9
        : "lowcost";
      let response = {};
      let transformedField = "";
      for (const key in measurement) {
        if (deviceCategory === "reference") {
          logText("the device is a BAM");
          transformedField = createFeed.getBamFieldLabel(key);
          logElement("transformedField", transformedField);
        } else if (deviceCategory === "lowcost") {
          logText("the device is a lowcost one");
          transformedField = createFeed.getFieldLabel(key);
        } else if (deviceCategory === "gas") {
          logText("the device is a gas one");
          transformedField = createFeed.getGasFieldLabel(key);
        } else {
          logText("the device does not have a category/type");
          return {};
        }
        if (transformedField) {
          response[transformedField] = measurement[key];
        }
      }
      return cleanDeep(response);
    } catch (e) {
      logObject("the transformMeasurement error", e);
    }
  },
  convertFromHectopascalsToKilopascals: (number) => {
    try {
      const convertedValue = number * 0.1;
      return {
        success: true,
        message: "Successfully converted Hectopascals To Kilopascals",
        data: convertedValue,
      };
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};
module.exports = createFeed;
