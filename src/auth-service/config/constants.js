const devConfig = {
  MONGO_URI: "mongodb://localhost/airqo-auth-dev",
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12
};
const testConfig = {
  MONGO_URI: "mongodb://localhost/airqo-auth-test",
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12
};
const prodConfig = {
  MONGO_URI: process.env.ATLAS_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  CLIENT_ORIGIN: "https://airqo.net/",
  BCRYPT_SALT_ROUNDS: 12
};
const defaultConfig = {
  PORT: process.env.PORT || 3000
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
  ...envConfig(process.env.NODE_ENV)
};
