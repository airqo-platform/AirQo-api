const devConfig = {
  MONGO_URI: "mongodb://localhost/",
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_DEV,
  REDIS_SERVER: process.env.REDIS_SERVER_DEV,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_CALIBRATION: (value) => {
    return `http://localhost:3000/api/v1/calibrate?raw_value=${value}`;
  },
};
const stageConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_CALIBRATION: (value) => {
    return `http://34.78.78.202:31011/api/v1/calibrate?raw_value=${value}`;
  },
};
const prodConfig = {
  MONGO_URI: process.env.MONGO_GCE_URI,
  JWT_SECRET: process.env.JWT_SECRET,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  GET_CALIBRATION: (value) => {
    return `http://34.78.78.202:30011/api/v1/calibrate?raw_value=${value}`;
  },
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
  GENERATE_LAST_HOURLY_ENTRY: (channel) => {
    return `https://api.thingspeak.com/channels/${channel}/feeds.json?days=1&average=60`;
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
