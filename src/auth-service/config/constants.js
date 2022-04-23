const devConfig = {
  MONGO_URI: `${process.env.MONGO_DEV_URI}`,
  DB_NAME: process.env.MONGO_DEV,
  PWD_RESET: `${process.env.PLATFORM_DEV_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/forgot`,
  BASE_URL: `${process.env.PLATFORM_DEV_BASE_URL}`,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_PROD_URI,
  DB_NAME: process.env.MONGO_PROD,
  PWD_RESET: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/forgot`,
  BASE_URL: `${process.env.PLATFORM_PRODUCTION_BASE_URL}`,
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_PROD_URI,
  DB_NAME: process.env.MONGO_STAGE,
  PWD_RESET: `${process.env.PLATFORM_STAGING_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_STAGING_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_STAGING_BASE_URL}/forgot`,
  BASE_URL: `${process.env.PLATFORM_STAGING_BASE_URL}`,
};

const defaultConfig = {
  PORT: process.env.PORT || 3000,
  PASSWORD_REGEX: () => process.env.PASSWORD_REGEX,
  CLIENT_ORIGIN: `${process.env.AIRQO_WEBSITE}`,
  BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL: process.env.MAIL_USER,
  REQUEST_ACCESS_EMAILS: process.env.REQUEST_ACCESS_EMAILS,
  YOUTUBE_CHANNEL: `${process.env.AIRQO_YOUTUBE}`,
  ACCOUNT_UPDATED: "The AirQo Platform account has successfully been updated",
  RANDOM_PASSWORD_CONFIGURATION: (length) => {
    return {
      length: length,
      numbers: true,
      uppercase: true,
      lowercase: true,
      strict: true,
    };
  },
  SALT_ROUNDS: 10,
  KICKBOX_API_KEY: process.env.KICKBOX_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
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
