const devConfig = {
  MONGO_URI: process.env.MONGO_DEV_URI,
  DB_NAME: process.env.MONGO_DEV,
  PWD_RESET: `${process.env.PLATFORM_DEV_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_DEV_BASE_URL,
  ENVIRONMENT: "DEVELOPMENT ENVIRONMENT",
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_PROD_URI,
  DB_NAME: process.env.MONGO_PROD,
  PWD_RESET: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_PRODUCTION_BASE_URL,
  ENVIRONMENT: "PRODUCTION ENVIRONMENT",
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_STAGE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  PWD_RESET: `${process.env.PLATFORM_STAGING_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_STAGING_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_STAGING_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_STAGING_BASE_URL,
  ENVIRONMENT: "STAGING ENVIRONMENT",
};

const defaultConfig = {
  EMAIL_VERIFICATION_HOURS: 0.5,
  EMAIL_VERIFICATION_MIN: 0,
  EMAIL_VERIFICATION_SEC: 0,
  DEFAULT_TENANT: "airqo",
  TWITTER_ACCOUNT: "https://twitter.com/AirQoProject",
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL,
  SLACK_USERNAME: process.env.SLACK_USERNAME,
  PRODUCTS_DEV_EMAIL: process.env.PRODUCTS_DEV_EMAIL,
  FIREBASE_COLLECTION_USERS: process.env.FIREBASE_COLLECTION_USERS,
  FIREBASE_COLLECTION_KYA: process.env.FIREBASE_COLLECTION_KYA,
  FIREBASE_COLLECTION_ANALYTICS: process.env.FIREBASE_COLLECTION_ANALYTICS,
  FIREBASE_COLLECTION_NOTIFICATIONS:
    process.env.FIREBASE_COLLECTION_NOTIFICATIONS,
  FIREBASE_COLLECTION_FAVORITE_PLACES:
    process.env.FIREBASE_COLLECTION_FAVORITE_PLACES,
  EMAIL_NAME: "AirQo Data Team",
  DEFAULT_LIMIT: process.env.DEFAULT_LIMIT,
  PORT: process.env.PORT || 3000,
  CLIENT_ORIGIN: process.env.AIRQO_WEBSITE,
  BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL: process.env.MAIL_USER,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  REQUEST_ACCESS_EMAILS: process.env.REQUEST_ACCESS_EMAILS,
  COMMS_EMAILS: process.env.COMMS_EMAILS,
  POLICY_EMAILS: process.env.POLICY_EMAILS,
  CHAMPIONS_EMAILS: process.env.CHAMPIONS_EMAILS,
  RESEARCHERS_EMAILS: process.env.RESEARCHERS_EMAILS,
  DEVELOPERS_EMAILS: process.env.DEVELOPERS_EMAILS,
  PARTNERS_EMAILS: process.env.PARTNERS_EMAILS,
  YOUTUBE_CHANNEL: process.env.AIRQO_YOUTUBE,
  ACCOUNT_UPDATED: "The AirQo Platform account has successfully been updated",
  RANDOM_PASSWORD_CONFIGURATION: (length) => {
    return {
      length: length,
      numbers: true,
      uppercase: true,
      lowercase: true,
      strict: true,
      excludeSimilarCharacters: true,
    };
  },
  SALT_ROUNDS: 10,
  KICKBOX_API_KEY: process.env.KICKBOX_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
  MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY,
  MAILCHIMP_SERVER_PREFIX: process.env.MAILCHIMP_SERVER_PREFIX,
  MAILCHIMP_LIST_ID: process.env.MAILCHIMP_LIST_ID,
};

function envConfig(env) {
  switch (env) {
    case "development":
      return devConfig;
    case "staging":
      return stageConfig;
    default:
      return prodConfig;
  }
}

module.exports = {
  ...defaultConfig,
  ...envConfig(process.env.NODE_ENV),
};
