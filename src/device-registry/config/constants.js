const { logElement } = require("../utils/log");

const devConfig = {
  MONGO_URL: `mongodb://localhost/`,
  DB_NAME: process.env.MONGO_DEV,
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
};
const prodConfig = {
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
    field6: "Battery Voltage",
    field7: "Temperature",
    field8: "NO2",
    field9: "SO3",
  },
  MONGO_URL: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  JWT_SECRET: process.env.JWT_SECRET,
};

const stageConfig = {
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
    field6: "Battery Voltage",
    field7: "Temperature",
    field8: "NO2",
    field9: "SO3",
  },
  MONGO_URL: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  JWT_SECRET: process.env.JWT_SECRET,
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
