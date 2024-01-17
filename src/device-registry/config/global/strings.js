const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logText } = require("@utils/log");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);
const strings = {
  REGION: "europe-west1",
  MQTT_BRIDGE_HOST_NAME: "mqtt.googleapis.com",
  MESSAGE_TYPE: "events",
};
module.exports = strings;
