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
  DEVICE_FILTER_TYPES: ["lowcost", "gas", "bam", "static", "mobile"],
  /**
   * Fields that may only be changed through dedicated lifecycle activity
   * endpoints (deploy / recall / maintain). Guards in the controller,
   * model modify()/bulkModify(), and background jobs all reference this
   * single source of truth.
   */
  LIFECYCLE_FIELDS: [
    "mobility",
    "deployment_type",
    "site_id",
    "grid_id",
    "status",
    "deployment_date",
    "recall_date",
    "isActive",
  ],
};
module.exports = staticLists;
