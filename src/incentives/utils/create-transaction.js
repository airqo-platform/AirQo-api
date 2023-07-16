const TransactionModel = require("@models/Transaction");
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger("create-transaction-util");

const createTransaction = {
  /**** HOST PAYMENTS */
  sendMoneyToHost: async (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  addMoneyToOrganisationAccount: async (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  receiveMoneyFromHost: async (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  getTransactionDetails: async (request) => {
    logText("getTransactionDetails.............");
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  /***** SIM CARD DATA LOADING */
  loadDataBundle: async (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  checkRemainingDataBundleBalance: async (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createTransaction;
