const { mongodb } = require("./dbConnection");

const devConfig = {
  MONGO_URI: "mongodb://localhost",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_DEV,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
};
const testConfig = {
  MONGO_URI: "mongodb://localhost",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_TEST,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
};
const prodConfig = {
  // MONGO_URI: process.env.ATLAS_URI,
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_PROD,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
};

const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_STAGE,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
};

const defaultConfig = {
  PORT: process.env.PORT || 3000,
};

function envConfig(env) {
  switch (env) {
    case "development":
      return devConfig;
    case "test":
      return testConfig;
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
