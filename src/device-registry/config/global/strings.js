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
  COMPROMISED_TOKEN_COOLDOWN_DAYS: 15,
  LOG_THROTTLE_TTL_DAYS: 30,
  EXPIRING_TOKEN_REMINDER_DAYS: 7,
  ALLOWED_LOG_TYPES: [
    "unassigned-sites-check",
    "network-status-check",
    "network-status-summary",
    "METRICS",
    "ACCURACY_REPORT",
  ],
};
module.exports = strings;
