const devConfig = {
  MONGO_URI: "mongodb://localhost/",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_DEV,
};
const stageConfig = {
  MONGO_URI: "mongodb://localhost/",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_STAGE,
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_PROD,
};
const defaultConfig = {
  PORT: process.env.PORT || 3000,
  API_URL_CHANNELS: `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_LAST_FIELD_ENTRY_AGE: (channel, field) => {
    return `https://api.thingspeak.com/channels/${channel.trim()}/fields/${field.trim()}/last_data_age.json`;
  },
  GET_CHANNEL_LAST_ENTRY_AGE: (channel) => {
    return `https://api.thingspeak.com/channels/${channel.trim()}/feeds/last_data_age.json`;
  },
  GENERATE_LAST_ENTRY: (channel) => {
    return `https://api.thingspeak.com/channels/${channel}/feeds.json`;
  },
  GET_FEEDS: (channel) => {
    return `https://api.thingspeak.com/channels/${channel}/feeds.json`;
  },
  GET_CHANNELS: `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_HOURLY_FEEDS: (channel) => {
    return `https://us-central1-airqo-250220.cloudfunctions.net/get_hourly_channel_data?channel_id=${channel}`;
  },
  GET_GPS: (channel) => {
    return `${channel}`;
  },
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

module.exports = { ...defaultConfig, ...envConfig(process.env.NODE_ENV) };
