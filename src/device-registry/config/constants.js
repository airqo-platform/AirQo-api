const { logElement } = require("../utils/log");

const devConfig = {
  MONGO_URI: `mongodb://localhost/`,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
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
    return `https://api.thingspeak.com/update.json?api_key=${apiKey}&${field}=${value}`;
  },
  ADD_VALUE_JSON: `https://api.thingspeak.com/update.json`,
  BULK_ADD_VALUES_JSON: (channel) => {
    return `https://api.thingspeak.com/channels/${channel}/bulk_update.json`;
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
    field1: "Sensor1 PM2.5_CF_1_ug/m3",
    field2: "Sensor1 PM10_CF_1_ug/m3",
    field3: "Sensor2 PM2.5_CF_1_ug/m3",
    field4: "Sensor2 PM10_CF_1_ug/m3",
    field5: "Latitude",
    field6: "Longitude",
    field7: "Battery Voltage",
    field8: "GpsData",
  },
  N_VALUES: 120000,
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
