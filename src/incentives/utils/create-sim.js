const SimModel = require("@models/Sim");
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-sim-util`);
const axios = require("axios");
const xml2js = require("xml2js");

/**
 * this module will start with 5 functions for now
 */

const createSim = {
  create: async (request) => {
    try {
      const { body } = request;
      const { tenant } = request.query;
      logObject("body", body);
      const responseFromRegisterSim = await SimModel(tenant).register(body);
      logObject("responseFromRegisterSim", responseFromRegisterSim);
      return responseFromRegisterSim;
    } catch (error) {
      logElement(" the util server error,", error.message);
      logger.error(`Internal Server Error --  ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  checkStatus: async (request) => {
    try {
      const { body } = request;
      const { tenant } = request.query;
      const postUrl =
        "https://api.thingsmobile.com/services/business-api/simStatus";
      const formData = {
        token: "token-value",
        msisdn: "msisdn-value",
        username: "username-value",
      };

      const options = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      axios
        .post(postUrl, new URLSearchParams(formData), options)
        .then(async (response) => {
          const xmlResponse = response.data;

          const parsedResponse = await xml2js.parseStringPromise(xmlResponse, {
            explicitArray: false,
            mergeAttrs: true,
          });

          const simInfo = parsedResponse.result.sims.sim;

          const jsonOutput = {
            balance: simInfo.balance,
            activationDate: simInfo.activationDate,
            msisdn: simInfo.msisdn,
            name: simInfo.name,
            status: simInfo.status,
            plan: simInfo.plan,
            totalTraffic: simInfo.totalTraffic,
            // Add more fields as needed
          };

          logObject("jsonOutput", jsonOutput);
        })
        .catch((error) => {
          logObject("error", error);
        });
    } catch (error) {
      logObject(" the util server error,", error.message);
      logger.error(`Internal Server Error --  ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  activateSim: () => {},
  deactivateSim: () => {},
  updateSimName: () => {},
  rechargeSim: () => {},
};

module.exports = createSim;
