const devConfig = {
  MONGO_URI: `mongodb://localhost/`,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
};
const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
};
const defaultConfig = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: "thisisasecret",
  MOMO_URL_DISBURSEMENTS: "https://sandbox.momodeveloper.mtn.com/disbursement",
  DISBURSEMENTS_MOMO_PRIMARY_KEY: process.env.DISBURSEMENTS_MOMO_PRIMARY_KEY,
  DISBURSEMENTS_MOMO_SECONDARY_KEY:
    process.env.DISBURSEMENTS_MOMO_SECONDARY_KEY,
  PROVIDER_CALLBACK_HOST: process.env.PROVIDER_CALLBACK_HOST,
  PHONE_NUMBER: process.env.PHONE_NUMBER,
};

function envConfig(env) {
  switch (env) {
    case "development":
      return devConfig;
    case "test":
      return stageConfig;
    default:
      return prodConfig;
  }
}

module.exports = { ...defaultConfig, ...envConfig(process.env.NODE_ENV) };
