const mongoose = require("mongoose");
const prodConfig = {
  DEFAULT_AIRQLOUD: process.env.PROD_DEFAULT_AIRQLOUD,
  DEFAULT_GRID: process.env.PROD_DEFAULT_GRID,
  DEFAULT_GROUP: process.env.PROD_DEFAULT_GROUP,
  DEFAULT_GROUP_ROLE: process.env.PROD_DEFAULT_GROUP_ROLE,
  DEFAULT_NETWORK: process.env.PROD_DEFAULT_NETWORK,
  DEFAULT_NETWORK_ROLE: process.env.PROD_DEFAULT_NETWORK_ROLE,
  MONGO_URI: process.env.MONGO_PROD_URI,
  DB_NAME: process.env.MONGO_PROD,
  PWD_RESET: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_PRODUCTION_BASE_URL,
  ANALYTICS_BASE_URL: "https://analytics.airqo.net",
  ENVIRONMENT: "PRODUCTION ENVIRONMENT",
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_PROD
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_PROD.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_PROD,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_PROD,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_PROD,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_PROD,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_PROD,
  REDIS_SERVER: process.env.PROD_REDIS_SERVER,
  REDIS_PORT: process.env.PROD_REDIS_PORT,
  SELECTED_SITES: process.env.SELECTED_SITES_PRODUCTION
    ? process.env.SELECTED_SITES_PRODUCTION.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
};
module.exports = prodConfig;
