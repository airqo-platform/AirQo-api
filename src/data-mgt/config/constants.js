const devConfig = {
  MONGO_URL: "mongodb://localhost/data-mgt-dev",
  JWT_SECRET: process.env.JWT_SECRET,
};
const testConfig = {
  MONGO_URL: "mongodb://localhost/data-mgt-test",
  JWT_SECRET: process.env.JWT_SECRET,
};
const prodConfig = {
  MONGO_URL: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
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

module.exports = { ...defaultConfig, ...envConfig(process.env.NODE_ENV) };
