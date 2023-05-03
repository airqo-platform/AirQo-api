const constants = require("@config/constants");
const NetworkSchema = require("@models/Network");
const UserSchema = require("@models/User");
const { getModelByTenant } = require("@config/dbConnection");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const httpStatus = require("http-status");
const companyEmailValidator = require("company-email-validator");
const isEmpty = require("is-empty");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- network-util`);

const NetworkModel = (tenant) => {
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(tenant, "network", NetworkSchema);
    return networks;
  }
};

const UserModel = (tenant) => {
  try {
    const users = mongoose.model("users");
    return users;
  } catch (error) {
    const users = getModelByTenant(tenant, "user", UserSchema);
    return users;
  }
};

const createNetwork = {
  getNetworkFromEmail: async (request) => {
    try {
      const responseFromExtractOneNetwork =
        createNetwork.extractOneAcronym(request);

      logObject("responseFromExtractOneNetwork", responseFromExtractOneNetwork);

      if (responseFromExtractOneNetwork.success === true) {
        const { tenant } = request.query;
        let filter = {};
        const skip = 0;
        const limit = 1;

        let modifiedRequest = Object.assign({}, request);
        modifiedRequest["query"] = {};
        modifiedRequest["query"]["net_acronym"] =
          responseFromExtractOneNetwork.data;

        const responseFromGenerateFilter =
          generateFilter.networks(modifiedRequest);

        logObject("responseFromGenerateFilter", responseFromGenerateFilter);

        if (responseFromGenerateFilter.success === true) {
          filter = responseFromGenerateFilter.data;
          logObject("filter", filter);
        } else if (responseFromGenerateFilter.success === false) {
          return responseFromGenerateFilter;
        }

        const responseFromListNetworks = await NetworkModel(tenant).list({
          filter,
          limit,
          skip,
        });

        if (responseFromListNetworks.success === true) {
          const data = responseFromListNetworks.data;
          const storedNetwork = data[0]
            ? data[0].net_name || data[0].net_acronym
            : "";
          return {
            success: true,
            data: storedNetwork,
            message: data[0]
              ? "successfully retrieved the network"
              : "No network exists for this operation",
            status: httpStatus.OK,
          };
        } else if (responseFromListNetworks.success === false) {
          return responseFromListNetworks;
        }
      } else if (responseFromExtractOneNetwork.success === false) {
        return responseFromExtractOneNetwork;
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  extractOneAcronym: (request) => {
    try {
      const { net_email } = request.body;
      let segments = [];
      let network = "";

      if (net_email) {
        let isCompanyEmail = companyEmailValidator.isCompanyEmail(net_email);

        if (isCompanyEmail) {
          segments = net_email.split("@").filter((segment) => segment);
          network = segments[1].split(".")[0];
        } else if (!isCompanyEmail) {
          network = "airqo";
        }
      }

      return {
        success: true,
        data: network,
        status: httpStatus.OK,
        message: "successfully removed the file extension",
      };
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      };
    }
  },

  sanitizeName: (name) => {
    try {
      let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
      let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
      let trimmedName = shortenedName.trim();
      return trimmedName.toLowerCase();
    } catch (error) {
      logElement("the sanitise name error", error.message);
    }
  },
  create: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      let modifiedBody = Object.assign({}, body);

      const responseFromExtractNetworkName =
        createNetwork.extractOneAcronym(request);

      logObject(
        "responseFromExtractNetworkName",
        responseFromExtractNetworkName
      );

      if (responseFromExtractNetworkName.success === true) {
        modifiedBody["net_name"] = responseFromExtractNetworkName.data;
        modifiedBody["net_acronym"] = responseFromExtractNetworkName.data;
      } else if (responseFromExtractNetworkName.success === false) {
        return responseFromExtractNetworkName;
      }

      logObject("modifiedBody", modifiedBody);
      const responseFromRegisterNetwork = await NetworkModel(tenant).register(
        modifiedBody
      );

      logObject("responseFromRegisterNetwork", responseFromRegisterNetwork);

      if (responseFromRegisterNetwork.success === true) {
        return responseFromRegisterNetwork;
      } else if (responseFromRegisterNetwork.success === false) {
        return responseFromRegisterNetwork;
      }
    } catch (err) {
      return {
        success: false,
        message: "network util server errors",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  assignUsers: async (request) => {
    try {
      const { net_id } = request.params;
      const { tenant } = request.query;
      const { user_ids } = request.body;

      return await NetworkModel(tenant)
        .findById(net_id)
        .then(async (network) => {
          if (!network) {
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: "the provided Network does not exist" },
            };
          }
          return await UserModel(tenant)
            .find({ _id: { $in: user_ids } })
            .then((users) => {
              if (users.length !== user_ids.length) {
                return {
                  success: false,
                  message: "Internal Server Error",
                  errors: { message: "One or more users not found" },
                  status: httpStatus.BAD_REQUEST,
                };
              }

              try {
                users.forEach((user) => {
                  user.networks.push(net_id);
                  user.save();
                });
              } catch (error) {
                if (error.code === 11000) {
                  logger.error(
                    `Duplicate network being assigned to a user, ignoring -- ${error.message}`
                  );
                } else {
                  logger.error(`Internal Server Error -- ${error.message}`);
                }
              }

              try {
                network.net_users.push(...user_ids);
                network.save();
              } catch (error) {
                logger.error(`Internal Server Error -- ${error.message}`);
              }

              return {
                success: true,
                message:
                  "successfully assigned all the provided users to the provided network",
                status: httpStatus.OK,
              };
            });
        })
        .catch((error) => {
          logger.error(`Internal Server Error -- ${error.message}`);
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: error.message },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          };
        });
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

  assignOneUser: async (request) => {
    try {
      const { net_id, user_id } = request.params;
      const { tenant } = request.query;

      const user = await UserModel(tenant).findById(user_id);
      if (!user) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "User not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const network = await NetworkModel(tenant).findById(net_id);
      if (!network) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Network not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (network.net_users.includes(user_id)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "User is already assigned to the Network" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (user.networks.includes(net_id)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Network is already assigned to the User" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      try {
        user.networks.push(net_id);
        await user.save();
      } catch (error) {
        logger.error(`error while adding network to user -- ${error.message}`);
      }

      try {
        network.net_users.push(user_id);
        await network.save();
      } catch (error) {
        logger.error(`error while adding user to network -- ${error.message}`);
      }

      return {
        success: true,
        message: "User assigned to Network successfully",
        status: httpStatus.OK,
        data: { network, user },
      };
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

  unAssignUser: async (request) => {
    try {
      const { net_id, user_id } = request.params;
      const { tenant } = request.query;

      const userId = user_id.toString();
      const networkId = net_id.toString();

      let network = await NetworkModel(tenant).findById(net_id).lean();
      let user = await UserModel(tenant).findById(user_id).lean();

      if (isEmpty(network)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Network not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (isEmpty(user)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "User not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      let userNetworks = user.networks.map((id) => id.toString());
      let networkUsers = network.net_users.map((id) => id.toString());

      logObject("userNetworks", userNetworks);
      logObject("networkUsers", networkUsers);

      if (!userNetworks.includes(networkId)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Provided Network is not assigned to the User" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (!networkUsers.includes(userId)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Provided User is not part of the Network" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (network.net_manager) {
        network.net_manager = null;
      }

      // Remove user ID from the net_users array of the network
      try {
        network = await NetworkModel(tenant).findByIdAndUpdate(
          net_id,
          { $pull: { net_users: { $in: userId } }, net_manager: null },
          { new: true }
        );
      } catch (error) {
        logger.error(`Internal Server Error -- ${error.message}`);
        logObject("error", error);
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message: error.message,
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      // Remove network ID from the networks array of the user
      try {
        user = await UserModel(tenant).findByIdAndUpdate(
          user_id,
          { $pull: { networks: { $in: net_id } } },
          { new: true }
        );
      } catch (error) {
        logObject("error", error);
        logger.error(`Internal Server Error -- ${error.message}`);
        return {
          success: false,
          message: "Internal Server Error",
          errors: {
            message: error.message,
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      return {
        status: httpStatus.OK,
        message: "User successfully unassigned from the network",
        data: { network, user },
        success: true,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  setManager: async (request) => {
    try {
      const { net_id, user_id } = request.params;
      const { tenant } = request.query;

      const user = await UserModel(tenant).findById(user_id);
      if (!user) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "User not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const network = await NetworkModel(tenant).findById(net_id);
      if (!network) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Network not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (!network.net_users.includes(user_id)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Provided User is not assigned to the Network" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (!user.networks.includes(net_id)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Provided Network is not assigned to the User" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (network.net_manager && network.net_manager === user_id) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Network is already assigned to the User" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      try {
        user.networks.push(net_id);
        await user.save();
      } catch (error) {
        logger.error(`error while adding network to user -- ${error.message}`);
      }

      try {
        network.net_users.push(user_id);
        network.net_manager = user_id;

        await network.save();
      } catch (error) {
        logger.error(`error while adding user to network -- ${error.message}`);
      }

      return {
        success: true,
        message: "User assigned to Network successfully",
        status: httpStatus.OK,
        data: { network, user },
      };
    } catch (error) {
      logObject("error", error);
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
      const { body, query, params } = request;
      const { action } = request;
      const { tenant } = query;
      let update = Object.assign({}, body);
      logElement("action", action);
      update["action"] = action;

      let filter = {};
      const responseFromGeneratefilter = generateFilter.networks(request);

      if (responseFromGeneratefilter.success === true) {
        filter = responseFromGeneratefilter.data;
      } else if (responseFromGeneratefilter.success === false) {
        return responseFromGeneratefilter;
      }

      if (!isEmpty(params.user_id)) {
        /**
         * we also need to update the Users?
         */
        const usersArray = params.user_id.toString().split(",");
        const modifiedUsersArray = usersArray.map((user_id) => {
          return ObjectId(user_id);
        });
        update.net_users = modifiedUsersArray;
      } else if (!isEmpty(update.user_ids)) {
        /**
         * we also need to update the Users?
         */
        const usersArray = update.user_ids.toString().split(",");
        const modifiedUsersArray = usersArray.map((user_id) => {
          return ObjectId(user_id);
        });
        update.net_users = modifiedUsersArray;
      }

      if (!isEmpty(action)) {
        if (action === "setManager") {
          /**
           * we could also first check if they belong to the network?
           */
          update["$addToSet"] = {};
          update["$addToSet"]["net_users"] = {};
          update["$addToSet"]["net_users"]["$each"] = update.net_users;
          update["net_manager"] = update.net_users[0];
          delete update.net_users;
        }
      }

      const responseFromModifyNetwork = await NetworkModel(tenant).modify({
        update,
        filter,
      });

      if (responseFromModifyNetwork.success === true) {
        return responseFromModifyNetwork;
      } else if (responseFromModifyNetwork.success === false) {
        return responseFromModifyNetwork;
      }
    } catch (error) {
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  delete: async (request) => {
    try {
      logText("the delete operation.....");
      const { query } = request;
      const { tenant } = query;
      let filter = {};

      const responseFromGenerateFilter = generateFilter.networks(request);

      logObject("responseFromGenerateFilter", responseFromGenerateFilter);

      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
      } else if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      }

      logObject("the filter", filter);

      const responseFromRemoveNetwork = await NetworkModel(tenant).remove({
        filter,
      });

      logObject("responseFromRemoveNetwork", responseFromRemoveNetwork);

      if (responseFromRemoveNetwork.success === true) {
        return responseFromRemoveNetwork;
      } else if (responseFromRemoveNetwork.success === false) {
        return responseFromRemoveNetwork;
      }
    } catch (error) {
      return {
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
        success: false,
      };
    }
  },
  list: async (request) => {
    try {
      let { skip, limit, tenant } = request.query;
      let filter = {};

      const responseFromGenerateFilter = generateFilter.networks(request);
      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
        logObject("filter", filter);
      }

      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      }

      const responseFromListNetworks = await NetworkModel(tenant).list({
        filter,
        limit,
        skip,
      });

      if (responseFromListNetworks.success === true) {
        return responseFromListNetworks;
      } else if (responseFromListNetworks.success === false) {
        return responseFromListNetworks;
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = createNetwork;
