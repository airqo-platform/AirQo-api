const axios = require("axios");
const isEmpty = require("is-empty");
const { logElement, logText, logObject } = require("./log");
const jsonify = require("./jsonify");
const constants = require("../config/constants");

const feed = {
  readDeviceMeasurementsFromThingspeak: ({
    channel,
    api_key,
    start,
    end,
  } = {}) => {
    try {
      if (isEmpty(start) && !isEmpty(end)) {
        return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}&end=${end}`;
      }
      if (isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}&start=${start}`;
      }

      if (isEmpty(end) && isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}`;
      }
      if (!isEmpty(end) && !isEmpty(start)) {
        return `${constants.THINGSPEAK_BASE_URL}/${channel}/feeds.json?api_key=${api_key}&start=${start}&end=${end}`;
      }
    } catch (error) {
      logElement(
        "the error for generating urls of getting Thingspeak feeds",
        error.message
      );
    }
  },
};
module.exports = feed;
