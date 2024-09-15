const mongoose = require("mongoose");
const devConfig = {
  DEFAULT_AIRQLOUD: process.env.DEV_DEFAULT_AIRQLOUD,
  DEFAULT_GRID: process.env.DEV_DEFAULT_GRID,
  DEFAULT_GROUP: process.env.DEV_DEFAULT_GROUP,
  DEFAULT_GROUP_ROLE: process.env.DEV_DEFAULT_GROUP_ROLE,
  DEFAULT_NETWORK: process.env.DEV_DEFAULT_NETWORK,
  DEFAULT_NETWORK_ROLE: process.env.DEV_DEFAULT_NETWORK_ROLE,
  MONGO_URI: process.env.MONGO_DEV_URI,
  DB_NAME: process.env.MONGO_DEV,
  PWD_RESET: `${process.env.PLATFORM_DEV_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_DEV_BASE_URL,
  ANALYTICS_BASE_URL: "http://localhost:5000",
  ENVIRONMENT: "DEVELOPMENT ENVIRONMENT",
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_DEV
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_DEV.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_DEV,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_DEV,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_DEV,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_DEV,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_DEV,
  REDIS_SERVER: process.env.DEV_REDIS_SERVER,
  REDIS_PORT: process.env.DEV_REDIS_PORT,
};
module.exports = devConfig;
