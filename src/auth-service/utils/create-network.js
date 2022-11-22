const NetworkSchema = require("../models/Network");
const { getModelByTenant } = require("./multitenancy");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const HTTPStatus = require("http-status");
const companyEmailValidator = require("company-email-validator");

const createNetwork = {
  getNetworkFromEmail: async (request) => {
    try {
      let responseFromExtractOneNetwork =
        createNetwork.extractOneAcronym(request);

      if (responseFromExtractOneNetwork.success === true) {
        let acronym = responseFromExtractOneNetwork.data;
        let modifiedRequest = request;
        modifiedRequest["query"] = {};
        modifiedRequest["query"]["acronym"] = acronym;
        let responseFromListNetworks = await createNetwork.list(
          modifiedRequest
        );
        if (responseFromListNetworks.success === true) {
          let data = responseFromListNetworks.data;
          let storedNetwork = data[0].name || data[0].acronym;
          return {
            success: true,
            data: storedNetwork,
            message: "successfully retrieved the network",
            status: HTTPStatus.OK,
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
      const { email } = request.body;
      let segments = [];
      let network = "";

      if (email) {
        let isCompanyEmail = companyEmailValidator.isCompanyEmail(email);

        if (isCompanyEmail) {
          segments = email.split("@").filter((segment) => segment);
          network = segments[1].split(".")[0];
        }

        if (!isCompanyEmail) {
          network = "airqo";
        }
      }

      return {
        success: true,
        data: network,
        status: HTTPStatus.OK,
        message: "successfully removed the file extension",
      };
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
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
      let { body } = request;
      let modifiedBody = body;

      const responseFromExtractNetworkName =
        createNetwork.extractOneAcronym(request);

      if (responseFromExtractNetworkName.success === true) {
        modifiedBody["name"] = responseFromExtractNetworkName.data;
        modifiedBody["acronym"] = responseFromExtractNetworkName.data;
      } else if (responseFromExtractNetworkName.success === false) {
        // return responseFromExtractNetworkName;
      }

      let responseFromRegisterNetwork = await getModelByTenant(
        "airqo",
        "network",
        NetworkSchema
      ).register(modifiedBody);

      logObject("responseFromRegisterNetwork", responseFromRegisterNetwork);

      if (responseFromRegisterNetwork.success === true) {
        let status = responseFromRegisterNetwork.status
          ? responseFromRegisterNetwork.status
          : "";
        return {
          success: true,
          message: responseFromRegisterNetwork.message,
          data: responseFromRegisterNetwork.data,
          status,
        };
      } else if (responseFromRegisterNetwork.success === false) {
        let errors = responseFromRegisterNetwork.errors
          ? responseFromRegisterNetwork.errors
          : "";

        let status = responseFromRegisterNetwork.status
          ? responseFromRegisterNetwork.status
          : "";

        return {
          success: false,
          message: responseFromRegisterNetwork.message,
          errors,
          status,
        };
      }
    } catch (err) {
      return {
        success: false,
        message: "network util server errors",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      let { body, query } = request;
      let tenant = "airqo";
      let update = body;
      let filter = {};
      let responseFromGeneratefilter = generateFilter.networks(request);

      if (responseFromGeneratefilter.success === true) {
        filter = responseFromGeneratefilter.data;
      }

      if (responseFromGeneratefilter.success === false) {
        let status = responseFromGeneratefilter.status
          ? responseFromGeneratefilter.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromGeneratefilter.errors
          ? responseFromGeneratefilter.errors
          : "";
        return {
          message: "Internal Server Error",
          errors,
          status,
          success: false,
        };
      }

      let responseFromModifyNetwork = await getModelByTenant(
        "airqo",
        "network",
        NetworkSchema
      ).modify({ update, filter });

      if (responseFromModifyNetwork.success === true) {
        let status = responseFromModifyNetwork.status
          ? responseFromModifyNetwork.status
          : "";
        return {
          message: responseFromModifyNetwork.message,
          status,
          data: responseFromModifyNetwork.data,
          success: true,
        };
      }

      if (responseFromModifyNetwork.success === false) {
        let status = responseFromModifyNetwork.status
          ? responseFromModifyNetwork.status
          : "";
        let errors = responseFromModifyNetwork.errors
          ? responseFromModifyNetwork.errors
          : "";
        return {
          success: false,
          message: responseFromModifyNetwork.message,
          errors,
          status,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: error,
      };
    }
  },
  delete: async (request) => {
    try {
      logText("the delete operation.....");
      let { query, body } = request;
      let tenant = "airqo";
      let filter = {};

      let responseFromGenerateFilter = generateFilter.networks(request);

      logObject("responseFromGenerateFilter", responseFromGenerateFilter);

      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
      }

      if (responseFromGenerateFilter.success === false) {
        let status = responseFromGenerateFilter.status
          ? responseFromGenerateFilter.status
          : "";
        let errors = responseFromGenerateFilter.errors
          ? responseFromGenerateFilter.errors
          : "";
        return {
          status,
          errors,
          message: responseFromGenerateFilter.message,
        };
      }

      logObject("the filter", filter);

      let responseFromRemoveNetwork = await getModelByTenant(
        "airqo",
        "network",
        NetworkSchema
      ).remove({ filter });

      logObject("responseFromRemoveNetwork", responseFromRemoveNetwork);

      if (responseFromRemoveNetwork.success === true) {
        let status = responseFromRemoveNetwork.status
          ? responseFromRemoveNetwork.status
          : "";

        return {
          status,
          message: responseFromRemoveNetwork.message,
          data: responseFromRemoveNetwork.data,
          success: true,
        };
      }

      if (responseFromRemoveNetwork.success === false) {
        let status = responseFromRemoveNetwork.status
          ? responseFromRemoveNetwork.status
          : "";
        let errors = responseFromRemoveNetwork.errors
          ? responseFromRemoveNetwork.errors
          : "";

        return {
          message: responseFromRemoveNetwork.message,
          errors,
          status,
          success: false,
        };
      }
    } catch (error) {
      return {
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
        success: false,
      };
    }
  },
  list: async (request) => {
    try {
      let { skip, limit } = request.query;
      let tenant = "airqo";
      let filter = {};

      let responseFromGenerateFilter = generateFilter.networks(request);
      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
        logObject("filter", filter);
      }

      if (responseFromGenerateFilter.success === false) {
        let errors = responseFromGenerateFilter.errors
          ? responseFromGenerateFilter.errors
          : "";
        return {
          success: false,
          message: responseFromGenerateFilter.message,
          errors,
        };
      }

      let responseFromListNetworks = await getModelByTenant(
        "airqo",
        "network",
        NetworkSchema
      ).list({ filter, limit, skip });

      logObject("responseFromListNetworks", responseFromListNetworks);

      if (responseFromListNetworks.success === true) {
        let status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : "";

        return {
          success: true,
          status,
          message: responseFromListNetworks.message,
          data: responseFromListNetworks.data,
        };
      }

      if (responseFromListNetworks.success === false) {
        let status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : "";
        let errors = responseFromListNetworks.errors
          ? responseFromListNetworks.errors
          : "";

        return {
          success: false,
          status,
          errors,
          message: responseFromListNetworks.message,
        };
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return {
        success: false,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: error.message,
      };
    }
  },
};

module.exports = createNetwork;
