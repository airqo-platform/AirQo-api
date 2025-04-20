const mongoose = require("mongoose");
const prodConfig = {
  DEFAULT_AIRQLOUD: process.env.PROD_DEFAULT_AIRQLOUD,
  DEFAULT_GRID: process.env.PROD_DEFAULT_GRID,
  DEFAULT_GROUP: process.env.PROD_DEFAULT_GROUP,
  DEFAULT_GROUP_ROLE: process.env.PROD_DEFAULT_GROUP_ROLE,
  DEFAULT_NETWORK: process.env.PROD_DEFAULT_NETWORK,
  DEFAULT_NETWORK_ROLE: process.env.PROD_DEFAULT_NETWORK_ROLE,
  MONGO_URI: process.env.MONGO_PROD_URI,
  COMMAND_MONGO_URI: process.env.COMMAND_MONGO_PROD_URI,
  QUERY_MONGO_URI: process.env.QUERY_MONGO_PROD_URI,
  DB_NAME: process.env.MONGO_PROD,
  PWD_RESET: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_PRODUCTION_BASE_URL,
  ANALYTICS_BASE_URL: "https://analytics.airqo.net",
  ENVIRONMENT: "PRODUCTION ENVIRONMENT",

  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_PROD,
  SELECTED_SITES: process.env.SELECTED_SITES_PRODUCTION
    ? process.env.SELECTED_SITES_PRODUCTION.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  API_TOKEN: process.env.PROD_API_TOKEN,
  PADDLE_SUCCESS_REDIRECT_URL: process.env.PROD_PADDLE_SUCCESS_REDIRECT_URL,
  PADDLE_CANCEL_REDIRECT_URL: process.env.PROD_PADDLE_CANCEL_REDIRECT_URL,
  PADDLE_PUBLIC_KEY: process.env.PROD_PADDLE_PUBLIC_KEY,
  PADDLE_SECRET_KEY: process.env.PROD_PADDLE_SECRET_KEY,
  PADDLE_ENVIRONMENT: process.env.PROD_PADDLE_ENVIRONMENT,
  PADDLE_API_KEY: process.env.PROD_PADDLE_API_KEY,

  //kafka
  KAFKA_CLIENT_ID:
    process.env.PROD_KAFKA_CLIENT_ID ||
    process.env.KAFKA_CLIENT_ID_PROD ||
    "prod-auth-service-client-id",
  KAFKA_BOOTSTRAP_SERVERS: process.env.PROD_KAFKA_BOOTSTRAP_SERVERS
    ? process.env.PROD_KAFKA_BOOTSTRAP_SERVERS.split(",").filter(
        (value) => value.trim() !== ""
      )
    : ["localhost:9092"],
  UNIQUE_PRODUCER_GROUP:
    process.env.PROD_UNIQUE_PRODUCER_GROUP ||
    "prod-device-registry-producer-group",
  UNIQUE_CONSUMER_GROUP:
    process.env.PROD_UNIQUE_CONSUMER_GROUP || "prod-auth-service-client-group",

  KAFKA_TOPICS: process.env.KAFKA_TOPICS_PROD,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_PROD,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_PROD,

  //redis
  REDIS_SERVER: process.env.PROD_REDIS_SERVER,
  REDIS_HOST: process.env.PROD_REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.PROD_REDIS_PORT || "6379", 10),
  REDIS_PASSWORD: process.env.PROD_REDIS_PASSWORD || null,
  REDIS_DB: parseInt(process.env.PROD_REDIS_DB || "0", 10),

  //rabbitMQ
  RABBITMQ_HOST: process.env.PROD_RABBITMQ_HOST || "localhost",
  RABBITMQ_PORT: parseInt(process.env.PROD_RABBITMQ_PORT || "5672", 10),
  RABBITMQ_USERNAME: process.env.PROD_RABBITMQ_USERNAME || "guest",
  RABBITMQ_PASSWORD: process.env.PROD_RABBITMQ_PASSWORD || "guest",
  RABBITMQ_VHOST: process.env.PROD_RABBITMQ_VHOST || "/",

  ENABLE_MESSAGE_CONSUMER:
    process.env.PROD_ENABLE_MESSAGE_CONSUMER === undefined
      ? true
      : process.env.PROD_ENABLE_MESSAGE_CONSUMER.toLowerCase() === "true",

  MESSAGE_BROKER_ALLOW_NO_CONNECTION:
    process.env.PROD_MESSAGE_BROKER_ALLOW_NO_CONNECTION === "true",
  MESSAGE_BROKER_INITIAL_DELAY_MS: parseInt(
    process.env.PROD_MESSAGE_BROKER_INITIAL_DELAY_MS || "0",
    10
  ),
};
module.exports = prodConfig;
