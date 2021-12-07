const axios = require("axios");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("../utils/log");
const jsonify = require("../utils/jsonify");

const devConfig = {
  MONGO_URI: "mongodb://localhost/",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `http://localhost:3000/api/v1/devices?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECYPT_DEVICE_KEY_URL: "http://localhost:3000/api/v1/devices/decrypt",
};
const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `https://staging-platform.airqo.net/api/v1/devices?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECYPT_DEVICE_KEY_URL:
    "https://staging-platform.airqo.net/api/v1/devices/decrypt",
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `https://platform.airqo.net/api/v1/devices?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECYPT_DEVICE_KEY_URL: "https://platform.airqo.net/api/v1/devices/decrypt",
};
const defaultConfig = {
  TS_TEST_CHANNEL: process.env.TS_TEST_CHANNEL,
  TS_API_KEY_TEST_DEVICE: process.env.TS_API_KEY_TEST_DEVICE,
  GET_CHANNELS_CACHE_EXPIRATION: 300,
  GET_LAST_ENTRY_CACHE_EXPIRATION: 30,
  GET_HOURLY_CACHE_EXPIRATION: 3600,
  GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION: 30,
  GET_CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION: 30,
  GET_LAST_FIELD_ENTRY_AGE_CACHE_EXPIRATION: 30,
  GET_DEVICE_COUNT_CACHE_EXPIRATION: 300,
  PORT: process.env.PORT || 3000,
  API_URL_CHANNELS: `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_LAST_FIELD_ENTRY_AGE: (channel, field) => {
    return `https://api.thingspeak.com/channels/${channel.trim()}/fields/${field.trim()}/last_data_age.json`;
  },
  GET_CHANNEL_LAST_ENTRY_AGE: (channel) => {
    return `https://api.thingspeak.com/channels/${channel.trim()}/feeds/last_data_age.json`;
  },
  THINGSPEAK_BASE_URL: "https://api.thingspeak.com/channels",
  READ_DEVICE_FEEDS: ({
    channel = process.env.TS_TEST_CHANNEL,
    api_key = process.env.TS_API_KEY_TEST_DEVICE,
    start = Date.now(),
    end = Date.now(),
  } = {}) => {
    return `https://api.thingspeak.com/channels/${channel}/feeds.json?api_key=${api_key}&start=${start}&end=${end}`;
  },
  GET_FEEDS: (channel) => {
    return `https://api.thingspeak.com/channels/${channel}/feeds.json`;
  },
  GET_CHANNELS: `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_HOURLY_FEEDS: (channel) => {
    return `https://us-central1-airqo-250220.cloudfunctions.net/get_hourly_channel_data?channel_id=${channel}`;
  },
  GET_GPS: (channel) => {
    return `${channel}`;
  },
};

function envConfig(env) {
  switch (env) {
    case "development":
      return devConfig;
    case "staging":
      return stageConfig;
    default:
      return prodConfig;
  }
}

module.exports = { ...defaultConfig, ...envConfig(process.env.NODE_ENV) };
