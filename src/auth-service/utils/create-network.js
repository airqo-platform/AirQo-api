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
      /**
       *Find the network using the network ID provided in the path parameter
Check if the user already exists in the network's net_users array. If the user already exists, return an error message indicating that the user is already a member of the network.
If the user does not exist in the network's net_users array, add the user to the array.
Save the updated network document.
       */
    } catch (error) {
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

      /**
       * Can this addToSet functionality be handled from the Entity Static logic?
       */

      if (!isEmpty(action)) {
        if (action === "assignUsers" || action === "assignOneUser") {
          update["$addToSet"] = {};
          update["$addToSet"]["net_users"] = {};
          update["$addToSet"]["net_users"]["$each"] = update.net_users;
          delete update.net_users;
        } else if (action === "unAssignUser") {
          update["$pull"] = {};
          update["$pull"]["net_users"] = {};
          update["$pull"]["net_users"]["$in"] = update.net_users;
          delete update.net_users;
        } else if (action === "setManager") {
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

      const responseFromModifyUser = await UserModel(tenant).modify({
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
