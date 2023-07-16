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
    } catch (error) {}
  },
  addMoneyToOrganisationAccount: async (request) => {
    try {
    } catch (error) {}
  },
  receiveMoneyFromHost: async (request) => {
    try {
    } catch (error) {}
  },
  getTransactionDetails: async (request) => {
    logText("send money to host.............");
    try {
    } catch (error) {}
  },
  /***** SIM CARD DATA LOADING */
  loadDataBundle: async (request) => {
    try {
    } catch (error) {}
  },
  checkRemainingDataBundleBalance: async (request) => {
    try {
    } catch (error) {}
  },
};

module.exports = createTransaction;
