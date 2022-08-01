const axios = require("axios");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("../utils/log");

const devConfig = {
  MONGO_URI: "mongodb://localhost/",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `${
      process.env.DEVICE_REGISTRY_BASE_URL_DEV
    }?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECYPT_DEVICE_KEY_URL: `${process.env.DEVICE_REGISTRY_BASE_URL_DEV}/decrypt`,
};
const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `${
      process.env.DEVICE_REGISTRY_BASE_URL_STAGE
    }?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECYPT_DEVICE_KEY_URL: `${process.env.DEVICE_REGISTRY_BASE_URL_STAGE}/decrypt`,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `${
      process.env.DEVICE_REGISTRY_BASE_URL_PROD
    }?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECYPT_DEVICE_KEY_URL: `${process.env.DEVICE_REGISTRY_BASE_URL_PROD}/decrypt`,
};
const defaultConfig = {
  TS_TEST_CHANNEL: process.env.TS_TEST_CHANNEL,
  TS_API_KEY_TEST_DEVICE: process.env.TS_API_KEY_TEST_DEVICE,
  GET_CHANNELS_CACHE_EXPIRATION: process.env.GET_CHANNELS_CACHE_EXPIRATION,
  GET_LAST_ENTRY_CACHE_EXPIRATION: process.env.GET_LAST_ENTRY_CACHE_EXPIRATION,
  GET_HOURLY_CACHE_EXPIRATION: process.env.GET_HOURLY_CACHE_EXPIRATION,
  GET_DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION:
    process.env.DESCRPIPTIVE_LAST_ENTRY_CACHE_EXPIRATION,
  GET_CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION:
    process.env.CHANNEL_LAST_ENTRY_AGE_CACHE_EXPIRATION,
  GET_LAST_FIELD_ENTRY_AGE_CACHE_EXPIRATION:
    process.env.LAST_FIELD_ENTRY_AGE_CACHE_EXPIRATION,
  GET_DEVICE_COUNT_CACHE_EXPIRATION: process.env.DEVICE_COUNT_CACHE_EXPIRATION,
  PORT: process.env.PORT || 3000,
  API_URL_CHANNELS: `${process.env.THINGSPEAK_BASE_URL}/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_LAST_FIELD_ENTRY_AGE: (channel, field) => {
    return `${
      process.env.THINGSPEAK_BASE_URL
    }/channels/${channel.trim()}/fields/${field.trim()}/last_data_age.json`;
  },
  GET_CHANNEL_LAST_ENTRY_AGE: (channel) => {
    return `${
      process.env.THINGSPEAK_BASE_URL
    }/channels/${channel.trim()}/feeds/last_data_age.json`;
  },
  THINGSPEAK_BASE_URL: process.env.THINGSPEAK_BASE_URL,
  READ_DEVICE_FEEDS: ({
    channel = process.env.TS_TEST_CHANNEL,
    api_key = process.env.TS_API_KEY_TEST_DEVICE,
    start = Date.now(),
    end = Date.now(),
  } = {}) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?api_key=${api_key}&start=${start}&end=${end}`;
  },
  GET_FEEDS: (channel) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json`;
  },
  GET_CHANNELS: `${process.env.THINGSPEAK_BASE_URL}/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_HOURLY_FEEDS: (channel) => {
    return `${process.env.CLOUD_FUNCTIONS_BASE_URL}/get_hourly_channel_data?channel_id=${channel}`;
  },
  GET_GPS: (channel) => {
    return `${channel}`;
  },

  BAM_FIELDS_AND_DESCRIPTIONS: {
    field1: "Date and time",
    field2: "ConcRt(ug/m3)",
    field3: "ConcHR(ug/m3)",
    field4: "ConcS(ug/m3)",
    field5: "Flow(LPM)",
    field6: "DeviceStatus",
    field7: "Logger Battery",
    field8: "CompleteBAM dataset Comma Separated Data",
    created_at: "created_at",
  },

  BAM_FIELDS_AND_LABELS: {
    field1: "date",
    field2: "realtime_concetration",
    field3: "hourly_concetration",
    field4: "shorttime_concetration",
    field5: "litres_per_minute",
    field6: "device_status",
    field7: "battery_voltage",
    field8: "other_data",
    created_at: "created_at",
  },

  BAM_POSITIONS_AND_LABELS: {
    0: "datetime",
    1: "realtime_concetration",
    2: "hourly_concetration",
    3: "shorttime_concetration",
    4: "litres_per_minute",
    5: "ws_ms",
    6: "wd_deg",
    7: "at_c",
    8: "rh",
    9: "bp_mmhg",
    10: "ft_c",
    11: "frh",
    12: "device_status",
  },

  FIELDS_AND_LABELS: {
    field1: "pm2_5",
    field2: "pm10",
    field3: "s2_pm2_5",
    field4: "s2_pm10",
    field5: "latitude",
    field6: "longitude",
    field7: "battery",
    field8: "other_data",
    created_at: "created_at",
  },

  POSITIONS_AND_LABELS: {
    0: "latitude",
    1: "longitude",
    2: "altitude",
    3: "speed",
    4: "satellites",
    5: "hdop",
    6: "internalTemperature",
    7: "internalHumidity",
    8: "externalTemperature",
    9: "ExternalHumidity",
    10: "ExternalPressure",
    11: "ExternalAltitude",
    12: "DeviceType",
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
