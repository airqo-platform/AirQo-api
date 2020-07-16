const { mongodb } = require("./dbConnection");

const devConfig = {
  MONGO_URI: `${mongodb}://localhost/`,
  DB_NAME: "airqo-auth-dev",
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
};
const testConfig = {
  MONGO_URI: `${mongodb}://localhost/`,
  DB_NAME: "airqo-auth-test",
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12,
};
const prodConfig = {
  MONGO_URI: `${mongodb}://${process.env.MONGO_GCE_USERNAME}:${MONGO_GCE_PASSWORD}@${MONGO_GCE_HOST}:${MONGO_GCE_PORT}/`,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: "airqo_analytics",
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
    default:
      return prodConfig;
  }
}

module.exports = {
  ...defaultConfig,
  ...envConfig(process.env.NODE_ENV),
};
