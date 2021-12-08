const axios = require("axios");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("./log");
const jsonify = require("./jsonify");
const constants = require("../config/constants");

const feed = {
  readDeviceMeasurementsFromThingspeak: ({ request } = {}) => {
    try {
      logObject("the request", request);
      const { channel, api_key, start, end, path } = request;
      if (isEmpty(start) && !isEmpty(end)) {
        return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}&end=${end}`;
      }
      if (isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}&start=${start}`;
      }
      if (!isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}&start=${start}&end=${end}`;
      }
      if (!isEmpty(path) && path === "last") {
        return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}`;
      }
      return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}`;
    } catch (error) {
      logElement(
        "the error for generating urls of getting Thingspeak feeds",
        error.message
      );
    }
  },
};
module.exports = feed;
