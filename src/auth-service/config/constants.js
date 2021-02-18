const devConfig = {
  MONGO_URI: "mongodb://localhost",
  DB_NAME: process.env.MONGO_DEV,
  PWD_RESET: "http://localhost:5000/reset",
  LOGIN_PAGE: "http://localhost:5000/login",
  FORGOT_PAGE: "http://localhost:5000/forgot",
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  // PWD_RESET: "http://34.78.78.202:30101",
  PWD_RESET: "http://platform.airqo.net/reset",
  LOGIN_PAGE: "http://platform.airqo.net/login",
  FORGOT_PAGE: "http://platform.airqo.net/forgot",
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  PWD_RESET: "http://staging-platform.airqo.net/reset",
  LOGIN_PAGE: "http://staging-platform.airqo.net/login",
  FORGOT_PAGE: "http://staging-platform.airqo.net/forgot",
};

const defaultConfig = {
  PORT: process.env.PORT || 3000,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL: process.env.MAIL_USER,
  YOUTUBE_CHANNEL: "https://www.youtube.com/channel/UCx7YtV55TcqKGeKsDdT5_XQ",
  ACCOUNT_UPDATED: "The AirQo Platform account has successfully been updated",
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
