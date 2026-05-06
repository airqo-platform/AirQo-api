const mongoose = require("mongoose");

// Helper functions for type conversion
const parseNumber = (value, defaultValue) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseBoolean = (value, defaultValue) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  // Handle string representations
  const stringValue = String(value).toLowerCase();
  if (stringValue === "true" || stringValue === "1") {
    return true;
  }
  if (stringValue === "false" || stringValue === "0") {
    return false;
  }
  return defaultValue;
};

const envs = {
  KICKBOX_API_KEY: process.env.KICKBOX_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
  MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY,
  MAILCHIMP_SERVER_PREFIX: process.env.MAILCHIMP_SERVER_PREFIX,
  MAILCHIMP_LIST_ID: process.env.MAILCHIMP_LIST_ID,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL: process.env.MAIL_USER,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  YOUTUBE_CHANNEL: process.env.AIRQO_YOUTUBE,

  // ✅ NUMERIC VALUES - Properly converted
  DEFAULT_LIMIT: parseNumber(process.env.DEFAULT_LIMIT, 100),
  PORT: parseNumber(process.env.PORT, 3000),
  ONBOARDING_TOKEN_EXPIRY_DAYS: parseNumber(
    process.env.ONBOARDING_TOKEN_EXPIRY_DAYS,
    7,
  ),
  MAX_ONBOARDING_TOKEN_EXPIRY_DAYS: parseNumber(
    process.env.MAX_ONBOARDING_TOKEN_EXPIRY_DAYS,
    30,
  ),

  CLIENT_ORIGIN: process.env.AIRQO_WEBSITE,
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL,
  SLACK_USERNAME: process.env.SLACK_USERNAME,
  PRODUCTS_DEV_EMAIL: process.env.PRODUCTS_DEV_EMAIL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  MOBILE_APP_USERS_TOPIC: process.env.MOBILE_APP_USERS_TOPIC,
  DEPLOY_TOPIC: process.env.DEPLOY_TOPIC,
  RECALL_TOPIC: process.env.RECALL_TOPIC,
  NETWORK_EVENTS_TOPIC:
    process.env.NETWORK_EVENTS_TOPIC || "network-events-topic",
  NETWORK_CREATION_REQUESTS_TOPIC:
    process.env.NETWORK_CREATION_REQUESTS_TOPIC ||
    "network-creation-requests-topic",
  NETWORK_CREATION_APPROVED_TOPIC:
    process.env.NETWORK_CREATION_APPROVED_TOPIC ||
    "network-creation-approved-topic",
  NETWORK_CREATION_DENIED_TOPIC:
    process.env.NETWORK_CREATION_DENIED_TOPIC ||
    "network-creation-denied-topic",
  UNIQUE_CONSUMER_GROUP: process.env.UNIQUE_CONSUMER_GROUP,
  UNIQUE_PRODUCER_GROUP: process.env.UNIQUE_PRODUCER_GROUP,
  NEW_MOBILE_APP_USER_TOPIC: process.env.NEW_MOBILE_APP_USER_TOPIC,
  DEFAULT_TENANT: process.env.DEFAULT_TENANT
    ? process.env.DEFAULT_TENANT.toLowerCase()
    : undefined,
  MOBILE_APP_PACKAGE_NAME: process.env.MOBILE_APP_PACKAGE_NAME,
  AIRQO_WEBSITE: process.env.AIRQO_WEBSITE,
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_AUTHORIZATION_URL: process.env.FIREBASE_AUTHORIZATION_URL,
  FIREBASE_TYPE: process.env.FIREBASE_TYPE,
  FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_CLIENT_ID: process.env.FIREBASE_CLIENT_ID,
  FIREBASE_AUTH_URI: process.env.FIREBASE_AUTH_URI,
  FIREBASE_TOKEN_URI: process.env.FIREBASE_TOKEN_URI,
  FIREBASE_AUTH_PROVIDER_X509_CERT_URL:
    process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  FIREBASE_CLIENT_X509_CERT_URL: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  FIREBASE_UNIVERSE_DOMAIN: process.env.FIREBASE_UNIVERSE_DOMAIN,
  FIREBASE_VERIFICATION_SUCCESS_REDIRECT:
    process.env.FIREBASE_VERIFICATION_SUCCESS_REDIRECT,
  GMAIL_VERIFICATION_FAILURE_REDIRECT:
    process.env.GMAIL_VERIFICATION_FAILURE_REDIRECT,
  GMAIL_VERIFICATION_SUCCESS_REDIRECT:
    process.env.GMAIL_VERIFICATION_SUCCESS_REDIRECT,
  SESSION_SECRET: process.env.SESSION_SECRET,
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
  PADDLE_PRODUCT_ID: process.env.PADDLE_PRODUCT_ID,
  PADDLE_DEFAULT_SUBSCRIPTION_PRICE_ID:
    process.env.PADDLE_DEFAULT_SUBSCRIPTION_PRICE_ID,
  PADDLE_STANDARD_PRICE_ID: process.env.PADDLE_STANDARD_PRICE_ID,
  PADDLE_PREMIUM_PRICE_ID: process.env.PADDLE_PREMIUM_PRICE_ID,
  DEFAULT_ORGANISATION_PROFILE_PICTURE:
    process.env.DEFAULT_ORGANISATION_PROFILE_PICTURE,
  DEFAULT_USE_ONBOARDING_FLOW: parseBoolean(
    process.env.DEFAULT_USE_ONBOARDING_FLOW,
    false,
  ),
  ORGANISATIONS_LIMIT: parseNumber(process.env.ORGANISATIONS_LIMIT, 10),
  USE_REDIS_RATE_LIMIT: true,
  RATE_LIMIT_WHITELIST: process.env.RATE_LIMIT_WHITELIST,
  // MongoDB connection pool size. Default 100 supports ~1000 concurrent
  // logins across 3 replicas (each login uses ~3-5 pool slots).
  // Tune via MONGODB_POOL_SIZE env var without a code change.
  MONGODB_POOL_SIZE: parseNumber(process.env.MONGODB_POOL_SIZE, 100),
  // Maximum concurrent background IP analysis operations per pod.
  // Shedding work above this threshold prevents OOM during DB slowness.
  // Tune via IP_ANALYSIS_CONCURRENCY env var without a code change.
  IP_ANALYSIS_CONCURRENCY: (() => {
    const val = Math.floor(parseNumber(process.env.IP_ANALYSIS_CONCURRENCY, 50));
    return Number.isFinite(val) && val >= 1 ? val : 50;
  })(),

  // ── Feedback domain constants ──────────────────────────────────────────────
  // Single source of truth shared between the Feedback model and validators.
  FEEDBACK_CATEGORIES: [
    "general",
    "bug",
    "feature_request",
    "performance",
    "ux_design",
    "other",
  ],
  FEEDBACK_STATUSES: ["pending", "reviewed", "resolved", "archived"],
  FEEDBACK_PLATFORMS: ["web", "mobile", "api"],
  // Conservative cap: reject metadata objects whose JSON serialisation exceeds
  // this byte count. Keeps individual documents well under MongoDB's 16 MB
  // document limit and avoids storage/query cost surprises.
  FEEDBACK_METADATA_MAX_BYTES: 4096,
  // Optional pro/HTTPS-capable IP geolocation endpoint. When set, device.util
  // uses this URL for login location lookups; when absent, geolocation is
  // skipped entirely (returns null) to avoid plaintext HTTP calls.
  // Example: https://pro.ip-api.com/json/<ip>?fields=status,city,regionName,country&key=<API_KEY>
  IP_API_PRO_URL: process.env.IP_API_PRO_URL || null,

  // Firebase Firestore collection names
  FIREBASE_COLLECTION_USERS: process.env.FIREBASE_COLLECTION_USERS,
  FIREBASE_COLLECTION_KYA: process.env.FIREBASE_COLLECTION_KYA,
  FIREBASE_COLLECTION_ANALYTICS: process.env.FIREBASE_COLLECTION_ANALYTICS,
  FIREBASE_COLLECTION_NOTIFICATIONS: process.env.FIREBASE_COLLECTION_NOTIFICATIONS,
  FIREBASE_COLLECTION_FAVORITE_PLACES: process.env.FIREBASE_COLLECTION_FAVORITE_PLACES,

  // ── Database ───────────────────────────────────────────────────────────────
  MONGO_URI: process.env.MONGO_URI,
  COMMAND_MONGO_URI: process.env.COMMAND_MONGO_URI,
  QUERY_MONGO_URI: process.env.QUERY_MONGO_URI,
  DB_NAME: process.env.DB_NAME,

  // ── Cache / Redis ──────────────────────────────────────────────────────────
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: parseNumber(process.env.REDIS_PORT, 6379),

  // ── Paddle payments ────────────────────────────────────────────────────────
  PADDLE_API_KEY: process.env.PADDLE_API_KEY,
  PADDLE_ENVIRONMENT: process.env.PADDLE_ENVIRONMENT,

  // ── Platform URLs ──────────────────────────────────────────────────────────
  ANALYTICS_BASE_URL: process.env.ANALYTICS_BASE_URL,
  VERTEX_BASE_URL: process.env.VERTEX_BASE_URL,

  // ── Security ───────────────────────────────────────────────────────────────
  ADMIN_SETUP_SECRET: process.env.ADMIN_SETUP_SECRET,
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,
  FORCE_SAFE_TOKEN_STRATEGY: parseBoolean(
    process.env.FORCE_SAFE_TOKEN_STRATEGY,
    false,
  ),

  // ── OAuth providers ────────────────────────────────────────────────────────
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
  TWITTER_CONSUMER_KEY: process.env.TWITTER_CONSUMER_KEY,
  TWITTER_CONSUMER_SECRET: process.env.TWITTER_CONSUMER_SECRET,

  // ── Kafka ──────────────────────────────────────────────────────────────────
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,

  // ── Platform defaults ──────────────────────────────────────────────────────
  NODE_ENV: process.env.NODE_ENV,
  DEFAULT_GROUP: process.env.DEFAULT_GROUP,
  DEFAULT_NETWORK: process.env.DEFAULT_NETWORK,
  DEFAULT_GROUP_ROLE: process.env.DEFAULT_GROUP_ROLE,
  DEFAULT_NETWORK_ROLE: process.env.DEFAULT_NETWORK_ROLE,
  DEFAULT_AIRQLOUD: process.env.DEFAULT_AIRQLOUD,
  DEFAULT_GRID: process.env.DEFAULT_GRID,
  TIMEZONE: process.env.TIMEZONE,

  // ── Email / notification routing ───────────────────────────────────────────
  HARDWARE_AND_DS_EMAILS: process.env.HARDWARE_AND_DS_EMAILS,
  REQUEST_ACCESS_EMAILS: process.env.REQUEST_ACCESS_EMAILS,

  // ── API / network ──────────────────────────────────────────────────────────
  API_TOKEN: process.env.API_TOKEN,
  SERVICE_NAME: process.env.SERVICE_NAME,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,

  // Tuning hints for analytics scoring; callers guard with ?.length fallbacks.
  AVAILABLE_SERVICES: process.env.AVAILABLE_SERVICES,
  AVAILABLE_ENDPOINTS: process.env.AVAILABLE_ENDPOINTS,
};

module.exports = envs;
