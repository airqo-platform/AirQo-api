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
  MTN_MOMO_URL_DISBURSEMENTS:
    "https://sandbox.momodeveloper.mtn.com/disbursement",
  PHONE_NUMBER: process.env.PHONE_NUMBER,
  MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY:
    process.env.MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY,
  MTN_MOMO_DISBURSEMENTS_SECONDARY_KEY:
    process.env.MTN_MOMO_DISBURSEMENTS_SECONDARY_KEY,
  MTN_MOMO_DISBURSEMENTS_USER_SECRET:
    process.env.MTN_MOMO_DISBURSEMENTS_USER_SECRET,
  MTN_MOMO_DISBURSEMENTS_USER_ID: process.env.MTN_MOMO_DISBURSEMENTS_USER_ID,
  MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY:
    process.env.MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY,
  MTN_MOMO_DISBURSEMENTS_CALLBACK_HOST:
    process.env.MTN_MOMO_DISBURSEMENTS_CALLBACK_HOST,
  MTN_MOMO_DISBURSEMENTS_PROVIDER_CALLBACK_HOST:
    process.env.MTN_MOMO_DISBURSEMENTS_PROVIDER_CALLBACK_HOST,
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
