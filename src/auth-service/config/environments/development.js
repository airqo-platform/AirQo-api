const mongoose = require("mongoose");

const devConfig = {
  DEFAULT_AIRQLOUD: process.env.DEV_DEFAULT_AIRQLOUD,
  DEFAULT_GRID: process.env.DEV_DEFAULT_GRID,
  DEFAULT_GROUP: process.env.DEV_DEFAULT_GROUP,
  DEFAULT_GROUP_ROLE: process.env.DEV_DEFAULT_GROUP_ROLE,
  DEFAULT_NETWORK: process.env.DEV_DEFAULT_NETWORK,
  DEFAULT_NETWORK_ROLE: process.env.DEV_DEFAULT_NETWORK_ROLE,
  MONGO_URI: process.env.MONGO_DEV_URI,
  COMMAND_MONGO_URI: process.env.COMMAND_MONGO_DEV_URI,
  QUERY_MONGO_URI: process.env.QUERY_MONGO_DEV_URI,
  DB_NAME: process.env.MONGO_DEV,
  PWD_RESET: `${process.env.PLATFORM_DEV_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_DEV_BASE_URL,
  ANALYTICS_BASE_URL: "http://localhost:5000",
  ENVIRONMENT: "DEVELOPMENT ENVIRONMENT",
  //kafka
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
  //redis
  REDIS_SERVER: process.env.DEV_REDIS_SERVER,
  REDIS_PORT: process.env.DEV_REDIS_PORT,
  SELECTED_SITES: process.env.SELECTED_SITES_DEVELOPMENT
    ? process.env.SELECTED_SITES_DEVELOPMENT.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  API_TOKEN: process.env.DEV_API_TOKEN,
  //paddle
  PADDLE_SUCCESS_REDIRECT_URL: process.env.DEV_PADDLE_SUCCESS_REDIRECT_URL,
  PADDLE_CANCEL_REDIRECT_URL: process.env.DEV_PADDLE_CANCEL_REDIRECT_URL,
  PADDLE_PUBLIC_KEY: process.env.DEV_PADDLE_PUBLIC_KEY,
  PADDLE_SECRET_KEY: process.env.DEV_PADDLE_SECRET_KEY,
  PADDLE_ENVIRONMENT: process.env.DEV_PADDLE_ENVIRONMENT,
  PADDLE_API_KEY: process.env.DEV_PADDLE_API_KEY,
  //kafka
  KAFKA_CLIENT_ID:
    process.env.DEV_KAFKA_CLIENT_ID || "dev-auth-service-client-id",
  KAFKA_BOOTSTRAP_SERVERS: process.env.DEV_KAFKA_BOOTSTRAP_SERVERS
    ? process.env.DEV_KAFKA_BOOTSTRAP_SERVERS.split(",")
    : ["localhost:9092"],
  UNIQUE_PRODUCER_GROUP:
    process.env.DEV_UNIQUE_PRODUCER_GROUP ||
    "dev-device-registry-producer-group",
  UNIQUE_CONSUMER_GROUP:
    process.env.DEV_UNIQUE_CONSUMER_GROUP || "dev-auth-service-client-group",

  //redis
  REDIS_HOST: process.env.DEV_REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.DEV_REDIS_PORT || "6379", 10),
  REDIS_PASSWORD: process.env.DEV_REDIS_PASSWORD || null,
  REDIS_DB: parseInt(process.env.DEV_REDIS_DB || "0", 10),

  //rabbitMQ
  RABBITMQ_HOST: process.env.DEV_RABBITMQ_HOST || "localhost",
  RABBITMQ_PORT: parseInt(process.env.DEV_RABBITMQ_PORT || "5672", 10),
  RABBITMQ_USERNAME: process.env.DEV_RABBITMQ_USERNAME || "guest",
  RABBITMQ_PASSWORD: process.env.DEV_RABBITMQ_PASSWORD || "guest",
  RABBITMQ_VHOST: process.env.DEV_RABBITMQ_VHOST || "/",

  ENABLE_MESSAGE_CONSUMER: process.env.DEV_ENABLE_MESSAGE_CONSUMER || false,

  MESSAGE_BROKER_ALLOW_NO_CONNECTION:
    process.env.DEV_MESSAGE_BROKER_ALLOW_NO_CONNECTION === "true",
  MESSAGE_BROKER_INITIAL_DELAY_MS: parseInt(
    process.env.DEV_MESSAGE_BROKER_INITIAL_DELAY_MS || "0",
    10
  ),
};

module.exports = devConfig;
