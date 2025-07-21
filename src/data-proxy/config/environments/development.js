const mongoose = require("mongoose");
const devConfig = {
  KAFKA_BOOTSTRAP_SERVERS: process.env.DEV_KAFKA_BOOTSTRAP_SERVERS,
  KAFKA_CLIENT_ID: process.env.DEV_KAFKA_CLIENT_ID,
  KAFKA_CLIENT_GROUP: process.env.DEV_KAFKA_CLIENT_GROUP,
  ENVIRONMENT: "DEVELOPMENT ENVIRONMENT",
  MONGO_URI: "mongodb://localhost/",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.DEV_REDIS_SERVER,
  REDIS_PORT: process.env.DEV_REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `${
      process.env.DEVICE_REGISTRY_BASE_URL_DEV
    }?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECRYPT_DEVICE_KEY_URL: `${process.env.DEVICE_REGISTRY_BASE_URL_DEV}/decrypt`,
};
module.exports = devConfig;
