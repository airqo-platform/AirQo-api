const devConfig = {
  MONGO_URI: "mongodb://localhost",
  DB_NAME: process.env.MONGO_DEV,
  PWD_RESET: "http://34.78.78.202:31104/reset",
  LOGIN_PAGE: "http://34.78.78.202:31104/login",
  FORGOT_PAGE: "http://34.78.78.202:31104/forgot",
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  // PWD_RESET: "http://34.78.78.202:30101",
  PWD_RESET: "http://platform.airqo.net/reset",
  LOGIN_PAGE: "http://34.78.78.202:30101/login",
  FORGOT_PAGE: "http://34.78.78.202:30101/forgot",
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  PWD_RESET: "http://34.78.78.202:31104/reset",
  LOGIN_PAGE: "http://34.78.78.202:31104/login",
  FORGOT_PAGE: "http://34.78.78.202:31104/forgot",
};

const defaultConfig = {
  PORT: process.env.PORT || 3000,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: process.env.JWT_SECRET,
  YOUTUBE_CHANNEL: "https://www.youtube.com/channel/UCx7YtV55TcqKGeKsDdT5_XQ",
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
