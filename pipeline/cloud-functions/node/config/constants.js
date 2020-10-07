GET_CHANNELS_TS_URI = `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`;
GET_RECENT_FEEDS = (channelID) => {
  return `https://data-manager-dot-airqo-250220.uc.r.appspot.com/api/v1/data/feeds/recent/${channelID}`;
};
DEVICE_REGISTRY_STAGE_BASE_URI = `http://34.78.78.202:31002/api/v1/devices/`;
DEVICE_REGISTRY_PROD_BASE_URI = `http://34.78.78.202:31002/api/v1/devices/`;
SINGLE_INSERT_PARTIAL = (deviceName, ctype) => {
  return `api/v1/devices/components/add/values?device=${deviceName}&component=${deviceName}_${ctype}&tenant=airqo`;
};
BULK_INSERT_PARTIAL = (base_url, deviceName, ctype) => {
  return `${base_url}/components/add/values/bulk?device=${deviceName}&component=${deviceName}_${ctype}`;
};
const DEVICE_REGITRY_BASE_URL = "http://34.78.78.202:31002/api/v1/devices/";
const MOST_RECENT_FEEDS_API_TS = (channel) => {
  return `https://api.thingspeak.com/channels/${channel}/feeds.json`;
};
const MOST_RECENT_FEEDS_API = (channel) => {
  return `https://data-manager-dot-airqo-250220.uc.r.appspot.com/api/v1/data/feeds/recent/${channel}`;
};
const SINGLE_INSERT_PARTIAL_API = (deviceName, ctype) => {
  return `api/v1/devices/components/add/values?device=${deviceName}&component=${deviceName}_${ctype}&tenant=airqo`;
};
const SAMPLE_FILE =
  "https://docs.google.com/spreadsheets/d/1ItQiF5LXhMLq4dRKRX6PqbM3cNMOt0SVtFU3_Zw0OmY/edit#gid=1433489674";

module.exports = {
  MOST_RECENT_FEEDS_API,
  SINGLE_INSERT_PARTIAL_API,
  DEVICE_REGITRY_BASE_URL,
  SAMPLE_FILE,
  SINGLE_INSERT_PARTIAL,
  DEVICE_REGISTRY_PROD_BASE_URI,
  DEVICE_REGISTRY_STAGE_BASE_UR,
  GET_RECENT_FEEDS,
  GET_CHANNELS_TS_URI,
};
