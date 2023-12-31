const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logText } = require("@utils/log");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);
const staticLists = {
  AQI_CATEGORIES: "good,moderate,u4sg,unhealthy,very_unhealthy,hazardous".split(
    ","
  ),
};
module.exports = staticLists;
