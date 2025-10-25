const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

const numericals = {
  DEFAULT_NEAREST_SITE_RADIUS: 15,
  MQTT_BRIDGE_PORT: 8883,
  NUM_MESSAGES: 5,
  TOKEN_EXP_MINS: 360,
  MINIMUM_BACKOFF_TIME: 1,
  MAXIMUM_BACKOFF_TIME: 32,
  CACHE_TIMEOUT_PERIOD: 10000,
  MAX_EVENT_AGE_HOURS: 6, // Only accept events from last 6 hours
  MAX_REJECTED_LOGS: 10,
  JOB_LOOKBACK_WINDOW_MS: 12 * 60 * 60 * 1000, // 12 hours
};

numericals.MAX_EVENT_AGE_MS = numericals.MAX_EVENT_AGE_HOURS * 60 * 60 * 1000;

module.exports = numericals;
