const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const urls = {
  API_URL_CHANNELS: `${process.env.THINGSPEAK_BASE_URL}/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_LAST_FIELD_ENTRY_AGE: (channel, field) => {
    return `${
      process.env.THINGSPEAK_BASE_URL
    }/channels/${channel.trim()}/fields/${field.trim()}/last_data_age.json`;
  },
  GET_CHANNEL_LAST_ENTRY_AGE: (channel) => {
    return `${
      process.env.THINGSPEAK_BASE_URL
    }/channels/${channel.trim()}/feeds/last_data_age.json`;
  },
  THINGSPEAK_BASE_URL: process.env.THINGSPEAK_BASE_URL,
  READ_DEVICE_FEEDS: ({
    channel = process.env.TS_TEST_CHANNEL,
    api_key = process.env.TS_API_KEY_TEST_DEVICE,
    start = Date.now(),
    end = Date.now(),
  } = {}) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json?api_key=${api_key}&start=${start}&end=${end}`;
  },
  GET_FEEDS: (channel) => {
    return `${process.env.THINGSPEAK_BASE_URL}/channels/${channel}/feeds.json`;
  },
  GET_CHANNELS: `${process.env.THINGSPEAK_BASE_URL}/channels.json?api_key=${process.env.TS_API_KEY}`,
  GET_HOURLY_FEEDS: (channel) => {
    return `${process.env.CLOUD_FUNCTIONS_BASE_URL}/get_hourly_channel_data?channel_id=${channel}`;
  },
};
module.exports = urls;
