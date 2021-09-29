const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logObject, logText } = require("./log");
const log4js = require("log4js");
const logger = log4js.getLogger("generate-filter-util");

const generateFilter = {
  hosts: (req) => {
    let { id } = req.query;
    let filter = {};

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    return filter;
  },
  transactions: (req) => {
    let { id, status, transaction_id, host_id } = req.query;
    let filter = {};

    if (host_id) {
      filter["host_id"] = ObjectId(host_id);
    }

    if (transaction_id) {
      filter["transaction_id"] = transaction_id;
    }

    if (id) {
      filter["_id"] = ObjectId(id);
    }

    if (status) {
      filter["status"] = status;
    }

    return filter;
  },
};

module.exports = generateFilter;
