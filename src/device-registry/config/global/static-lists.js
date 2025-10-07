const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);
const staticLists = {
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
  DEVICE_CATEGORIES: ["lowcost", "gas", "bam", "static", "mobile"],
};
module.exports = staticLists;
