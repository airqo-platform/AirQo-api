const mongoose = require("mongoose");
const stageConfig = {
  KAFKA_BOOTSTRAP_SERVERS: process.env.STAGE_KAFKA_BOOTSTRAP_SERVERS,
  KAFKA_CLIENT_ID: process.env.STAGE_KAFKA_CLIENT_ID,
  KAFKA_CLIENT_GROUP: process.env.STAGE_KAFKA_CLIENT_GROUP,
  ENVIRONMENT: "STAGING ENVIRONMENT",
  JWT_TOKEN: process.env.JWT_TOKEN_STAGING,
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.STAGE_REDIS_SERVER,
  REDIS_PORT: process.env.STAGE_REDIS_PORT,
  GET_DEVICES_URL: ({ tenant = "airqo", channel } = {}) => {
    return `${
      process.env.DEVICE_REGISTRY_BASE_URL_STAGE
    }?tenant=${tenant}&device_number=${channel.trim()}`;
  },
  DECRYPT_DEVICE_KEY_URL: `${process.env.DEVICE_REGISTRY_BASE_URL_STAGE}/decrypt`,
};

module.exports = stageConfig;
