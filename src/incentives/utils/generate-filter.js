const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logObject, logText } = require("./log");
const log4js = require("log4js");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- generate-filter-util`
);
const { HttpError } = require("@utils/errors");

const generateFilter = {
  hosts: (request, next) => {
    try {
      const { id, host_id } = { ...request.query, ...request.params };
      let filter = {};
      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (host_id) {
        filter["_id"] = ObjectId(host_id);
      }

      return filter;
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  transactions: (request, next) => {
    try {
      let { id, status, transaction_id, host_id } = {
        ...request.query,
        ...request.params,
      };
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
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  sims: (request, next) => {
    try {
      const { id, device_id, sim_id } = { ...request.query, ...request.params };
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (device_id) {
        filter["deviceId"] = ObjectId(device_id);
      }

      if (sim_id) {
        filter["_id"] = ObjectId(sim_id);
      }

      return filter;
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  networks: (request, next) => {
    try {
      const { name, net_id, network_codes, id } = {
        ...request.query,
        ...request.params,
      };
      let filter = {};
      if (name) {
        filter["name"] = name;
      }
      if (net_id) {
        filter["_id"] = ObjectId(net_id);
      }
      if (network_codes) {
        let networkCodesArray = network_codes.split(",");
        filter["network_codes"] = {};
        filter["network_codes"]["$in"] = networkCodesArray;
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      return filter;
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = generateFilter;
