const mongoose = require("mongoose");
const devConfig = {
  ADMIN_SETUP_SECRET: process.env.DEV_ADMIN_SETUP_SECRET,
  BYPASS_CAPTCHA: process.env.DEV_BYPASS_CAPTCHA === "true" || false,
  RECAPTCHA_SITE_KEY: process.env.DEV_RECAPTCHA_SITE_KEY,
  RECAPTCHA_SECRET_KEY: process.env.DEV_RECAPTCHA_SECRET_KEY,
  BYPASS_RATE_LIMIT: process.env.DEV_BYPASS_RATE_LIMIT === "true" || false,
  DEFAULT_AIRQLOUD: process.env.DEV_DEFAULT_AIRQLOUD,
  DEFAULT_GRID: process.env.DEV_DEFAULT_GRID,
  DEFAULT_GROUP: process.env.DEV_DEFAULT_GROUP,
  AIRQO_GROUP_ID: process.env.DEV_DEFAULT_GROUP,
  DEFAULT_GROUP_ROLE: process.env.DEV_DEFAULT_GROUP_ROLE,
  DEFAULT_NETWORK: process.env.DEV_DEFAULT_NETWORK,
  DEFAULT_NETWORK_ROLE: process.env.DEV_DEFAULT_NETWORK_ROLE,
  MONGO_URI: process.env.MONGO_DEV_URI,
  COMMAND_MONGO_URI: process.env.COMMAND_MONGO_DEV_URI,
  QUERY_MONGO_URI: process.env.QUERY_MONGO_DEV_URI,
  DB_NAME: process.env.MONGO_DEV,
  PWD_RESET: `${process.env.ANALYTICS_DEV_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.ANALYTICS_DEV_BASE_URL}/user/login`,
  FORGOT_PAGE: `${process.env.ANALYTICS_DEV_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.ANALYTICS_DEV_BASE_URL,
  ANALYTICS_BASE_URL: "http://localhost:5000",
  ENVIRONMENT: "DEVELOPMENT ENVIRONMENT",
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_DEV
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_DEV.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  GROUPS_TOPIC: process.env.GROUPS_TOPIC_DEV || "groups-topic",
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_DEV,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_DEV,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_DEV,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_DEV,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_DEV,
  REDIS_SERVER: process.env.DEV_REDIS_SERVER,
  REDIS_PORT: process.env.DEV_REDIS_PORT,
  SELECTED_SITES: process.env.SELECTED_SITES_DEVELOPMENT
    ? process.env.SELECTED_SITES_DEVELOPMENT.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  API_TOKEN: process.env.DEV_API_TOKEN,
  PADDLE_SUCCESS_REDIRECT_URL: process.env.DEV_PADDLE_SUCCESS_REDIRECT_URL,
  PADDLE_CANCEL_REDIRECT_URL: process.env.DEV_PADDLE_CANCEL_REDIRECT_URL,
  PADDLE_PUBLIC_KEY: process.env.DEV_PADDLE_PUBLIC_KEY,
  PADDLE_SECRET_KEY: process.env.DEV_PADDLE_SECRET_KEY,
  PADDLE_ENVIRONMENT: process.env.DEV_PADDLE_ENVIRONMENT,
  PADDLE_API_KEY: process.env.DEV_PADDLE_API_KEY,
  ONBOARDING_BASE_URL:
    process.env.DEV_ONBOARDING_BASE_URL ||
    "https://analytics.airqo.net/onboarding",
  ANALYTICS_PII_ENABLED:
    process.env.DEV_ANALYTICS_PII_ENABLED === "true" || false,
  POSTHOG_ENABLED: process.env.DEV_POSTHOG_ENABLED === "true" || false,
  POSTHOG_TRACK_API_REQUESTS:
    process.env.DEV_POSTHOG_TRACK_API_REQUESTS === "true" || false,
};
module.exports = devConfig;
