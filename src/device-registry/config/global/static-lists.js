const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);
const staticLists = {
  AQI_CATEGORIES: "good,moderate,u4sg,unhealthy,very_unhealthy,hazardous".split(
    ","
  ),
  VALID_DEVICE_STATUSES: [
    "recalled",
    "ready",
    "deployed",
    "undeployed",
    "decommissioned",
    "assembly",
    "testing",
    "not deployed",
  ],
};
module.exports = staticLists;
