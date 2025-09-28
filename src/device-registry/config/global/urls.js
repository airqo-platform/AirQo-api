const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

const urls = {
  REDIS_URL: process.env.REDIS_URL,
  GET_ROAD_METADATA: ({
    path,
    latitude,
    longitude,
    endDate,
    startDate,
  } = {}) => {
    if (path === "greenness") {
      return `${process.env.PLATFORM_BASE_URL}/api/v1/meta-data/${path}?latitude=${latitude}&longitude=${longitude}&startDate=${startDate}&endDate=${endDate}`;
    }
    return `${process.env.PLATFORM_BASE_URL}/api/v1/meta-data/${path}?latitude=${latitude}&longitude=${longitude}`;
  },
  GET_ADDRESS_URL: (lat, long) => {
    return `${process.env.MAPS_GOOGLEAPIS_BASE_URL}/maps/api/geocode/json?latlng=${lat},${long}&key=${process.env.GCP_KEY}`;
  },
  GET_ELEVATION_URL: (lat, long) => {
    return `${process.env.MAPS_GOOGLEAPIS_BASE_URL}/maps/api/elevation/json?locations=${lat},${long}&key=${process.env.GCP_KEY}`;
  },
  CREATE_THING_URL: `${process.env.THINGSPEAK_BASE_URL}/channels.json?api_key=${process.env.TS_API_KEY}`,
  DELETE_THING_URL: (device) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${device}.json?api_key=${process.env.TS_API_KEY}`;
  },
  CLEAR_THING_URL: (device) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${device}/feeds.json?api_key=${process.env.TS_API_KEY}`;
  },
  UPDATE_THING: (device) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${device}.json?api_key=${process.env.TS_API_KEY}`;
  },
  ADD_VALUE: (field, value, apiKey) => {
    return `${process.env.THINGSPEAK_BASE_URL}/update.json?api_key=${apiKey}&${field}=${value}`;
  },
  ADD_VALUE_JSON: `${process.env.THINGSPEAK_BASE_URL}/update.json`,
  BULK_ADD_VALUES_JSON: (channel) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${channel}/bulk_update.json`;
  },
  ADD_VALUES: (device) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${device}/bulk_update.json`;
  },
};
module.exports = urls;
