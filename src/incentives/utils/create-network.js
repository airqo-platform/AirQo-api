const NetworkModel = require("@models/Network");
const { logObject } = require("./log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-network-util`
);
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const createNetwork = {
  list: async (request) => {
    try {
      const { tenant, limit, skip } = request.query;
      const filter = generateFilter.networks(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }
      const responseFromListNetworks = await NetworkModel(tenant).list({
        filter,
        limit,
        skip,
      });
      return responseFromListNetworks;
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      /**
       * in the near future, this wont be needed since Kafka
       * will handle the entire update process
       */
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.networks(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }
      if (isEmpty(filter)) {
        return {
          success: false,
          message: "Unable to find filter value",
          errors: { message: "Unable to find filter value" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
      const network = await NetworkModel(tenant).find(filter).lean();

      logObject("network", network);

      if (network.length !== 1) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Invalid Network Data" },
          status: httpStatus.BAD_REQUEST,
        };
      } else {
        const networkId = network[0]._id;
        const responseFromUpdateNetwork = await NetworkModel(
          tenant
        ).findByIdAndUpdate(ObjectId(networkId), body, { new: true });

        logObject(
          "responseFromUpdateNetwork in Util",
          responseFromUpdateNetwork
        );

        if (!isEmpty(responseFromUpdateNetwork)) {
          return {
            success: true,
            message: "successfuly updated the network",
            status: httpStatus.OK,
            data: responseFromUpdateNetwork,
          };
        } else if (isEmpty(responseFromUpdateNetwork)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: "unable to update the Network" },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.networks(request);
      if (filter.success && filter.success === "false") {
        return filter;
      }

      const network = await NetworkModel(tenant).find(filter).lean();

      logObject("network", network);

      if (network.length !== 1) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Invalid Network Data" },
          status: httpStatus.BAD_REQUEST,
        };
      } else {
        const networkId = network[0]._id;
        const responseFromDeleteNetwork = await NetworkModel(
          tenant
        ).findByIdAndDelete(ObjectId(networkId));

        if (!isEmpty(responseFromDeleteNetwork)) {
          return {
            success: true,
            message: "successfuly deleted the network",
            status: httpStatus.OK,
            data: responseFromDeleteNetwork,
          };
        } else if (isEmpty(responseFromDeleteNetwork)) {
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: "unable to delete the Network" },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  create: async (request) => {
    try {
      /**
       * in the near future, this wont be needed since Kafka
       * will handle the entire creation process
       */
      const { query, body } = request;
      const { tenant } = query;

      const responseFromCreateNetwork = await NetworkModel(tenant).register(
        body
      );
      return responseFromCreateNetwork;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createNetwork;
