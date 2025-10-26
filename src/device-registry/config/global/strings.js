const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);
const strings = {
  REGION: "europe-west1",
  MQTT_BRIDGE_HOST_NAME: "mqtt.googleapis.com",
  MESSAGE_TYPE: "events",
  DEFAULT_COHORT_NAME: "airqo",
  TIMEZONE: "UTC",
  COMPROMISED_TOKEN_COOLDOWN_DAYS: 15,
  LOG_THROTTLE_TTL_DAYS: 30,
};
module.exports = strings;
