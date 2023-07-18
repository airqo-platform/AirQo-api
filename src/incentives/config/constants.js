const devConfig = {
  MONGO_URI: `mongodb://localhost/`,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
  XENTE_BASE_URL: process.env.XENTE_DEV_BASE_URL,
  XENTE_ACCOUNT_ID: process.env.XENTE_DEV_ACCOUNT_ID,
  XENTE_PASSWORD: process.env.XENTE_DEV_PASSWORD,
  XENTE_USERNAME: process.env.XENTE_DEV_USERNAME,
};
const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  XENTE_BASE_URL: process.env.XENTE_STAGE_BASE_URL,
  XENTE_ACCOUNT_ID: process.env.XENTE_STAGE_ACCOUNT_ID,
  XENTE_PASSWORD: process.env.XENTE_STAGE_PASSWORD,
  XENTE_USERNAME: process.env.XENTE_STAGE_USERNAME,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  XENTE_BASE_URL: process.env.XENTE_PROD_BASE_URL,
  XENTE_ACCOUNT_ID: process.env.XENTE_PROD_ACCOUNT_ID,
  XENTE_PASSWORD: process.env.XENTE_PROD_PASSWORD,
  XENTE_USERNAME: process.env.XENTE_PROD_USERNAME,
};
const defaultConfig = {
  NETWORKS: process.env.NETWORKS
    ? process.env.NETWORKS.split(",").filter((value) => value.trim() !== "")
    : [],
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL,
  SLACK_USERNAME: process.env.SLACK_USERNAME,
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
