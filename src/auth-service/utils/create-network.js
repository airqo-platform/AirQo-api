const NetworkSchema = require("../models/Network");
const UserSchema = require("../models/User");
const { getModelByTenant } = require("./multitenancy");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const httpStatus = require("http-status");
const companyEmailValidator = require("company-email-validator");
const isEmpty = require("is-empty");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;

const UserModel = (tenant) => {
  try {
    const users = mongoose.model("users");
    return users;
  } catch (error) {
    const users = getModelByTenant(tenant, "user", UserSchema);
    return users;
  }
};

const NetworkModel = (tenant) => {
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(tenant, "network", NetworkSchema);
    return networks;
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
          let data = responseFromListNetworks.data;
          let storedNetwork = data[0].net_name || data[0].net_acronym;
          return {
            success: true,
            data: storedNetwork,
            message: "successfully retrieved the network",
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
  update: async (request) => {
    try {
      let { body, query, params } = request;
      const { tenant } = query;
      let update = body;
      const actionBefore = request.path.split("/");
      const action = request.path.split("/")[2];
      logElement("actionBefore", actionBefore);
      logElement("action", action);
      update["action"] = action;
      let filter = {};
      let responseFromGeneratefilter = generateFilter.networks(request);

      if (!isEmpty(params.user_id)) {
        logElement("params.user_id", params.user_id);
        let usersArray = params.user_id.toString().split(",");
        let modifiedUsersArray = usersArray.map((user_id) => {
          return ObjectId(user_id);
        });
        update.net_users = modifiedUsersArray;
      } else if (!isEmpty(update.user_ids)) {
        let usersArray = update.user_ids.toString().split(",");
        let modifiedUsersArray = usersArray.map((user_id) => {
          return ObjectId(user_id);
        });
        update.net_users = modifiedUsersArray;
      }

      if (responseFromGeneratefilter.success === true) {
        filter = responseFromGeneratefilter.data;
        if (
          !isEmpty(params.user_id) &&
          !isEmpty(action) &&
          action === "unassign-user"
        ) {
          filter["net_users"] = ObjectId(params.user_id);
        }
      } else if (responseFromGeneratefilter.success === false) {
        return responseFromGeneratefilter;
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

      // logObject("responseFromListNetworks", responseFromListNetworks);

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
