const axios = require("axios");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("./log");
const constants = require("../config/constants");
const redis = require("../config/redis");
const { generateDateFormatWithoutHrs, isDate } = require("./date");
const cleanDeep = require("clean-deep");
const HTTPStatus = require("http-status");

const transform = {
  readDeviceMeasurementsFromThingspeak: ({ request } = {}) => {
    try {
      logObject("the request", request);
      const { channel, api_key, start, end, path } = request;
      if (isEmpty(start) && !isEmpty(end)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?api_key=${api_key}&end=${end}`;
      } else if (isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?api_key=${api_key}&start=${start}`;
      } else if (!isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?api_key=${api_key}&start=${start}&end=${end}`;
      } else if (!isEmpty(path) && path === "last") {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?api_key=${api_key}`;
      } else {
        return `${constants.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?api_key=${api_key}`;
      }
    } catch (error) {
      logElement(
        "the error for generating urls of getting Thingspeak feeds",
        error.message
      );
    }
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
  getAPIKey: async (channel, callback) => {
    try {
      logText("GET_API_KEY...........");
      const tenant = "airqo";
      let url = constants.GET_DEVICES_URL({ tenant, channel });
      logElement("the url inside GET API KEY", url);
      return axios
        .get(url, {
          headers: {
            Authorization: `JWT ${constants.JWT_TOKEN}`,
          },
        })
        .then(async (response) => {
          let responseJSON = response.data;
          if (responseJSON.success === true) {
            let deviceDetails = responseJSON.devices[0];
            logObject("deviceDetails", deviceDetails);
            if (isEmpty(deviceDetails)) {
              return callback({
                success: false,
                message: "device does not exist",
                status: HTTPStatus.NOT_FOUND,
              });
            } else if (!isEmpty(deviceDetails.readKey)) {
              let readKey = deviceDetails.readKey;
              logElement("readKey", readKey);
              const url = constants.DECRYPT_DEVICE_KEY_URL;
              return axios
                .post(
                  url,
                  {
                    encrypted_key: readKey,
                  },
                  {
                    headers: {
                      Authorization: `JWT ${constants.JWT_TOKEN}`,
                    },
                  }
                )
                .then((response) => {
                  let decrypted_key = response.data.decrypted_key;
                  return callback({
                    success: true,
                    data: decrypted_key,
                    message: "read key successfully retrieved",
                  });
                });
            } else {
              return callback({
                success: false,
                message:
                  "readKey unavailable, this might be an external device",
                status: HTTPStatus.NOT_FOUND,
              });
            }
          } else if (responseJSON.success === false) {
            return {
              success: false,
              message: responseJSON.message,
              errors: responseJSON.errors
                ? responseJSON.errors
                : { message: "internal server errors" },
            };
          }
        })
        .catch((error) => {
          logObject("an error for getting API key", error);
          return callback({
            success: false,
            message: "Internal Server Error",
            errors: { message: error },
          });
        });
    } catch (error) {
      logObject("an error in the get device API key util", error);
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
  getFieldByLabel: (value) => {
    try {
      return Object.keys(constants.FIELDS_AND_LABELS).find(
        (key) => constants.FIELDS_AND_LABELS[key] === value
      );
    } catch (error) {
      logElement("the getFieldByLabel error", error.message);
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
      let arrayValues = transform.getValuesFromString(otherData);
      let newObj = await Object.entries(arrayValues).reduce(
        (newObj, [position, value]) => {
          if (value) {
            let transformedPosition = transform.getPositionLabel({
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
          transformedField = transform.getBamFieldLabel(key);
          logElement("transformedField", transformedField);
        } else if (deviceCategory === "lowcost") {
          logText("the device is a lowcost one");
          transformedField = transform.getFieldLabel(key);
        } else if (deviceCategory === "gas") {
          logText("the device is a gas one");
          transformedField = transform.getGasFieldLabel(key);
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
  setCache: (data, request, callback) => {
    try {
      const cacheID = createEvent.generateCacheID(request);
      redis.set(
        cacheID,
        JSON.stringify({
          isCache: true,
          success: true,
          message: `successfully retrieved the measurements`,
          data,
        })
      );
      redis.expire(cacheID, parseInt(constants.EVENTS_CACHE_LIMIT));
      callback({
        success: true,
        message: "response stored in cache",
      });
    } catch (error) {
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  getCache: (request, callback) => {
    try {
      const cacheID = createEvent.generateCacheID(request);
      redis.get(cacheID, async (err, result) => {
        const resultJSON = JSON.parse(result);
        if (result) {
          callback({
            success: true,
            message: "utilising cache...",
            data: resultJSON,
          });
        } else if (err) {
          callback({
            success: false,
            message: "Internal Server Error",
            errors: { message: err.message },
          });
        } else {
          callback({
            success: false,
            message: "no cache present",
            data: resultJSON,
            errors: err,
          });
        }
      });
    } catch (error) {
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
      };
    }
  },
  generateCacheID: (request) => {
    const {
      device,
      device_number,
      device_id,
      site,
      site_id,
      tenant,
      skip,
      limit,
      frequency,
      startTime,
      endTime,
      metadata,
      external,
      recent,
    } = request.query;
    const currentTime = new Date().toISOString();
    const day = generateDateFormatWithoutHrs(currentTime);
    return `list_events_${device ? device : "noDevice"}_${tenant}_${
      skip ? skip : 0
    }_${limit ? limit : 0}_${recent ? recent : "noRecent"}_${
      frequency ? frequency : "noFrequency"
    }_${endTime ? endTime : "noEndTime"}_${
      startTime ? startTime : "noStartTime"
    }_${device_id ? device_id : "noDeviceId"}_${site ? site : "noSite"}_${
      site_id ? site_id : "noSiteId"
    }_${day ? day : "noDay"}_${
      device_number ? device_number : "noDeviceNumber"
    }_${metadata ? metadata : "noMetadata"}_${
      external ? external : "noExternal"
    }`;
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
module.exports = transform;
