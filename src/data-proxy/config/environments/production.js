const mongoose = require("mongoose");
const prodConfig = {
  KAFKA_BOOTSTRAP_SERVERS: process.env.PROD_KAFKA_BOOTSTRAP_SERVERS,
  KAFKA_CLIENT_ID: process.env.PROD_KAFKA_CLIENT_ID,
  KAFKA_CLIENT_GROUP: process.env.PROD_KAFKA_CLIENT_GROUP,
  ENVIRONMENT: "PRODUCTION ENVIRONMENT",
  JWT_TOKEN: process.env.JWT_TOKEN_PRODUCTION,
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.PROD_REDIS_SERVER,
  REDIS_PORT: process.env.PROD_REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `${
      process.env.DEVICE_REGISTRY_BASE_URL_PROD
    }?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECRYPT_DEVICE_KEY_URL: `${process.env.DEVICE_REGISTRY_BASE_URL_PROD}/decrypt`,
};
module.exports = prodConfig;
