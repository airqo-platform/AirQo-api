const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logObject, logText } = require("./log");
const log4js = require("log4js");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- generate-filter-util`
);

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
    try {
      let { id, status, transaction_id, host_id } = req.params;
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
    } catch (error) {
      return {
        success: false,
        message: "Internal Server error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  sims: (req) => {
    try {
      const { id } = req.query;
      const { sim_id } = req.params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (sim_id) {
        filter["_id"] = ObjectId(sim_id);
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
};

module.exports = generateFilter;
