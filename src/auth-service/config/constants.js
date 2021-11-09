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
  // PWD_RESET: "https://34.78.78.202:30101",
  PWD_RESET: "https://platform.airqo.net/reset",
  LOGIN_PAGE: "https://platform.airqo.net/login",
  FORGOT_PAGE: "https://platform.airqo.net/forgot",
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  PWD_RESET: "https://staging-platform.airqo.net/reset",
  LOGIN_PAGE: "https://staging-platform.airqo.net/login",
  FORGOT_PAGE: "https://staging-platform.airqo.net/forgot",
};

const defaultConfig = {
  PORT: process.env.PORT || 3000,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL: process.env.MAIL_USER,
  REQUEST_ACCESS_EMAILS: process.env.REQUEST_ACCESS_EMAILS,
  YOUTUBE_CHANNEL: "https://www.youtube.com/channel/UCx7YtV55TcqKGeKsDdT5_XQ",
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
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
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
