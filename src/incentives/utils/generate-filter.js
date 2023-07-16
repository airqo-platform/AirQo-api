const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logObject, logText } = require("./log");
const log4js = require("log4js");
const logger = log4js.getLogger("generate-filter-util");

const generateFilter = {
  hosts: (req) => {
    try {
      const { id } = req.query;
      const { host_id } = req.params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (host_id) {
        filter["_id"] = ObjectId(host_id);
      }

      return filter;
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        errors: { message: error.message },
        message: "Internal Server Error",
      };
    }
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
