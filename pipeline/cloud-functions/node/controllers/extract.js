const axios = require("axios");

const constants = ({
  GET_CHANNELS_TS_URI,
  MOST_RECENT_FEEDS_API,
  SINGLE_INSERT_PARTIAL_API,
  DEVICE_REGITRY_BASE_URL,
  SAMPLE_FILE,
  SINGLE_INSERT_PARTIAL,
  DEVICE_REGISTRY_PROD_BASE_URI,
  DEVICE_REGISTRY_STAGE_BASE_UR,
  GET_RECENT_FEEDS,
} = require("../config/constants"));

const getChannels = async () => {
  try {
    const channelsAPI = constants.GET_CHANNELS_TS_URI;
    console.log("channelsAPI", channelsAPI);
    const response = await axios.get(channelsAPI);
    return response.data;
  } catch (e) {
    console.log(e.message);
  }
};

const getDeviceName = async (channel) => {
  try {
    console.log("DEVICE_REGITRY_BASE_URL", DEVICE_REGITRY_BASE_URL);
    let response = await axios.get(`${DEVICE_REGITRY_BASE_URL}/`, {
      params: {
        chid: channel,
        tenant: "airqo",
      },
    });
    return response.data;
  } catch (e) {
    console.log(e.message);
  }
};

const getChannelMeasurement = async (channel) => {
  try {
    console.log("the channel for most recent feeds:", channel.id);
    console.log("mostRecentFeedsAPI", await MOST_RECENT_FEEDS_API(channel.id));
    let url = await MOST_RECENT_FEEDS_API(channel.id);
    let response = await axios.get(url);
    console.log("the measurement", response.data);
    return response.data;
  } catch (e) {
    console.log("get channel measurment:", e.message);
  }
};

module.exports = { getChannelMeasurement, getChannels, getDeviceName };
