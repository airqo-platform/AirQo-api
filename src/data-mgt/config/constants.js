const devConfig = {
  MONGO_URL: "mongodb://localhost/",
  DB_NAME: process.env.MONGO_DEV,
  JWT_SECRET: process.env.JWT_SECRET,
};
const testConfig = {
  MONGO_URL: "mongodb://localhost/",
  DB_NAME: process.env.MONGO_TEST,
  JWT_SECRET: process.env.JWT_SECRET,
};
const prodConfig = {
  MONGO_URL: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  JWT_SECRET: process.env.JWT_SECRET,
};
const stageConfig = {
  MONGO_URL: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  JWT_SECRET: process.env.JWT_SECRET,
};
const defaultConfig = {
  PORT: process.env.PORT || 3000,
};

function envConfig(env) {
  switch (env) {
    case "development":
      return devConfig;
    case "testing":
      return testConfig;
    case "staging":
      return stageConfig;
    case "production":
      return prodConfig;
    default:
      return prodConfig;
  }
}

module.exports = { ...defaultConfig, ...envConfig(process.env.NODE_ENV) };
