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
};
const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
};
const defaultConfig = {
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
  GENERATE_LAST_ENTRY: ({
    channel = process.env.TS_TEST_CHANNEL,
    api_key = process.env.TS_API_KEY_TEST_DEVICE,
  } = {}) => {
    return `https://api.thingspeak.com/channels/${channel}/feeds.json?api_key=${api_key}`;
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
  GET_API_KEY: async (channel) => {
    logText("GET_API_KEY...........");
    let url = `https://platform.airqo.net/api/v1/devices?tenant=airqo&chid=${channel.trim()}`;
    return axios
      .get(url)
      .then(async (response) => {
        let responseJSON = response.data;
        logObject("the response", responseJSON);
        if (responseJSON.success == true) {
          let deviceDetails = responseJSON.devices[0];
          let readKey = deviceDetails.readKey;
          if (!isEmpty(readKey)) {
            return {
              success: true,
              data: readKey,
              message: "read key successfully retrieved",
            };
          } else {
            return {
              success: false,
              message: "readKey unavailable, please update device details",
            };
          }
        } else if (responseJSON.success == false) {
          if (responseJSON.error) {
            return {
              success: false,
              error: error,
              message: responseJSON.message,
            };
          } else {
            return {
              success: false,
              message: responseJSON.message,
            };
          }
        }
      })
      .catch((error) => {
        return {
          success: false,
          error: error.message,
          message: "constants server side error",
        };
      });
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
