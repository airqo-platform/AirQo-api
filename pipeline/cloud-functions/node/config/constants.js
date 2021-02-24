const { logElement } = require("../utils/log");

const devConfig = {
  MONGO_URI: `mongodb://localhost/`,
  DB_NAME: process.env.MONGO_DEV,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
};

const defaultConfig = {
  PORT: process.env.PORT || 3000,
  CREATE_THING_URL: `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`,
  DELETE_THING_URL: (device) => {
    return `https://api.thingspeak.com/channels/${device}.json?api_key=${process.env.TS_API_KEY}`;
  },
  CLEAR_THING_URL: (device) => {
    return `https://api.thingspeak.com/channels/${device}/feeds.json?api_key=${process.env.TS_API_KEY}`;
  },
  UPDATE_THING: (device) => {
    return `https://api.thingspeak.com/channels/${device}.json?api_key=${process.env.TS_API_KEY}`;
  },
  ADD_VALUE: (field, value, apiKey) => {
    `https://api.thingspeak.com/update.json?api_key=${apiKey}&${field}=${value}`;
  },
  ADD_VALUES: (device) => {
    return `https://api.thingspeak.com/channels/${device}/bulk_update.json`;
  },
  JWT_SECRET: process.env.JWT_SECRET,
  REGION: "europe-west1",
  MQTT_BRIDGE_HOST_NAME: "mqtt.googleapis.com",
  MQTT_BRIDGE_PORT: 8883,
  NUM_MESSAGES: 5,
  TOKEN_EXP_MINS: 360,
  ALGORITHM: "RS256",
  HTTP_BRIDGE_ADDRESS: "cloudiotdevice.googleapis.com",
  MESSAGE_TYPE: "events",
  MINIMUM_BACKOFF_TIME: 1,
  MAXIMUM_BACKOFF_TIME: 32,
  DEVICE_CREATION: {
    field1: "Sensor1 PM2.5",
    field2: "Sensor1 PM10",
    field3: "Sensor2 PM2.5",
    field4: "Sensor2 PM10",
    field5: "Humidity",
    field5: "Battery Voltage",
    field6: "Temperature",
    field7: "NO2",
    field8: "SO3",
  },
  N_VALUES: 200,
  GET_CHANNELS_TS_URI: `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_RECENT_FEEDS: (channelID) => {
    return `https://data-manager-dot-airqo-250220.uc.r.appspot.com/api/v1/data/feeds/recent/${channelID}`;
  },
  DEVICE_REGISTRY_STAGE_BASE_URI: `http://34.78.78.202:31002/api/v1/devices/`,
  DEVICE_REGISTRY_PROD_BASE_URI: `http://34.78.78.202:31002/api/v1/devices/`,
  SINGLE_INSERT_PARTIAL: (deviceName, ctype) => {
    return `api/v1/devices/components/add/values?device=${deviceName}&component=${deviceName}_${ctype}&tenant=airqo`;
  },
  BULK_INSERT_PARTIAL: (base_url, deviceName, ctype) => {
    return `${base_url}/components/add/values/bulk?device=${deviceName}&component=${deviceName}_${ctype}`;
  },
  DEVICE_REGITRY_BASE_URL: "http://34.78.78.202:31002/api/v1/devices/",
  MOST_RECENT_FEEDS_API_TS: (channel) => {
    return `https://api.thingspeak.com/channels/${channel}/feeds.json`;
  },
  MOST_RECENT_FEEDS_API: (channel) => {
    return `https://data-manager-dot-airqo-250220.uc.r.appspot.com/api/v1/data/feeds/recent/${channel}`;
  },
  SINGLE_INSERT_PARTIAL_API: (deviceName, ctype) => {
    return `api/v1/devices/components/add/values?device=${deviceName}&component=${deviceName}_${ctype}&tenant=airqo`;
  },
  SAMPLE_FILE:
    "https://docs.google.com/spreadsheets/d/1ItQiF5LXhMLq4dRKRX6PqbM3cNMOt0SVtFU3_Zw0OmY/edit#gid=1433489674",
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
