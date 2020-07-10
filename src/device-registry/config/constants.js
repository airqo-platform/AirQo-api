const devConfig = {
  MONGO_URL: "mongodb://localhost/airqo-device-registry-dev",
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
const testConfig = {
  MONGO_URL: "mongodb://localhost/airqo-device-registry-test",
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
    field5: "Battery Voltage",
    field6: "Temperature",
    field7: "NO2",
    field8: "SO3",
  },
  MONGO_URL: process.env.MONGO_GCE_URI,
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
    field5: "Battery Voltage",
    field6: "Temperature",
    field7: "NO2",
    field8: "SO3",
  },
  MONGO_URL: process.env.MONGO_GCE_STAGE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
};

const defaultConfig = {
  PORT: process.env.PORT || 3000,
};

function envConfig(env) {
  switch (env) {
    case "development":
      return devConfig;
    case "test":
      return testConfig;
    case "staging":
      return stageConfig;
    default:
      return prodConfig;
  }
}

module.exports = { ...defaultConfig, ...envConfig(process.env.NODE_ENV) };
