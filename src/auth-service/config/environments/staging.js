const mongoose = require("mongoose");
const stageConfig = {
  DEFAULT_AIRQLOUD: process.env.STAGE_DEFAULT_AIRQLOUD,
  DEFAULT_GRID: process.env.STAGE_DEFAULT_GRID,
  DEFAULT_GROUP: process.env.STAGE_DEFAULT_GROUP,
  DEFAULT_GROUP_ROLE: process.env.STAGE_DEFAULT_GROUP_ROLE,
  DEFAULT_NETWORK: process.env.STAGE_DEFAULT_NETWORK,
  DEFAULT_NETWORK_ROLE: process.env.STAGE_DEFAULT_NETWORK_ROLE,
  MONGO_URI: process.env.MONGO_STAGE_URI,
  COMMAND_MONGO_URI: process.env.COMMAND_MONGO_STAGE_URI,
  QUERY_MONGO_URI: process.env.QUERY_MONGO_STAGE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  PWD_RESET: `${process.env.PLATFORM_STAGING_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_STAGING_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_STAGING_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_STAGING_BASE_URL,
  ANALYTICS_BASE_URL: "https://staging-analytics.airqo.net",
  ENVIRONMENT: "STAGING ENVIRONMENT",
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_STAGE,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_STAGE,
  KAFKA_RAW_MEASUREMENTS_TOPICS:
    process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_STAGE,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_STAGE,
  SELECTED_SITES: process.env.SELECTED_SITES_STAGING
    ? process.env.SELECTED_SITES_STAGING.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  API_TOKEN: process.env.STAGE_API_TOKEN,
  PADDLE_SUCCESS_REDIRECT_URL: process.env.STAGE_PADDLE_SUCCESS_REDIRECT_URL,
  PADDLE_CANCEL_REDIRECT_URL: process.env.STAGE_PADDLE_CANCEL_REDIRECT_URL,
  PADDLE_PUBLIC_KEY: process.env.STAGE_PADDLE_PUBLIC_KEY,
  PADDLE_SECRET_KEY: process.env.STAGE_PADDLE_SECRET_KEY,
  PADDLE_ENVIRONMENT: process.env.STAGE_PADDLE_ENVIRONMENT,
  PADDLE_API_KEY: process.env.STAGE_PADDLE_API_KEY,

  //kafka
  KAFKA_CLIENT_ID:
    process.env.STAGE_KAFKA_CLIENT_ID || "stage-auth-service-client-id",
  KAFKA_BOOTSTRAP_SERVERS: process.env.STAGE_KAFKA_BOOTSTRAP_SERVERS
    ? process.env.STAGE_KAFKA_BOOTSTRAP_SERVERS.split(",")
    : ["localhost:9092"],
  UNIQUE_PRODUCER_GROUP:
    process.env.STAGE_UNIQUE_PRODUCER_GROUP ||
    "stage-device-registry-producer-group",
  UNIQUE_CONSUMER_GROUP:
    process.env.STAGE_UNIQUE_CONSUMER_GROUP ||
    "stage-auth-service-client-group",

  //redis
  REDIS_SERVER: process.env.STAGE_REDIS_SERVER,
  REDIS_HOST: process.env.STAGE_REDIS_HOST || "localhost",
  REDIS_PORT: parseInt(process.env.STAGE_REDIS_PORT || "6379", 10),
  REDIS_PASSWORD: process.env.STAGE_REDIS_PASSWORD || null,
  REDIS_DB: parseInt(process.env.STAGE_REDIS_DB || "0", 10),

  //rabbitMQ
  RABBITMQ_HOST: process.env.STAGE_RABBITMQ_HOST || "localhost",
  RABBITMQ_PORT: parseInt(process.env.STAGE_RABBITMQ_PORT || "5672", 10),
  RABBITMQ_USERNAME: process.env.STAGE_RABBITMQ_USERNAME || "guest",
  RABBITMQ_PASSWORD: process.env.STAGE_RABBITMQ_PASSWORD || "guest",
  RABBITMQ_VHOST: process.env.STAGE_RABBITMQ_VHOST || "/",

  ENABLE_MESSAGE_CONSUMER: process.env.STAGE_ENABLE_MESSAGE_CONSUMER || true,

  MESSAGE_BROKER_ALLOW_NO_CONNECTION:
    process.env.STAGE_MESSAGE_BROKER_ALLOW_NO_CONNECTION === "true",
  MESSAGE_BROKER_INITIAL_DELAY_MS: parseInt(
    process.env.STAGE_MESSAGE_BROKER_INITIAL_DELAY_MS || "0",
    10
  ),
};

module.exports = stageConfig;
