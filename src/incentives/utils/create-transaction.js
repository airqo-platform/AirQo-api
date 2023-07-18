const TransactionModel = require("@models/transaction");
const constants = require("@config/constants");
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const generateFilter = require("@utils/generate-filter");
const log4js = require("log4js");
const logger = log4js.getLogger("create-transaction-util");
const axios = require("axios");
async function getFirstBearerToken() {
  let firstBearerToken;
  try {
    const firstTokenResponse = await axios.post(
      `${constants.XENTE_BASE_URL}/auth/login`,
      {
        username: constants.XENTE_USERNAME,
        password: constants.XENTE_PASSWORD,
      }
    );
    const statusCode = firstTokenResponse.status;

    if (statusCode === 401) {
      return {
        success: false,
        message: "Unauthorized",
        errors: { message: "Not Authorized" },
        status: httpStatus.UNAUTHORIZED,
      };
    }
    firstBearerToken = firstTokenResponse.data.token;
  } catch (error) {
    logObject("error", error);
    logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
    return {
      success: false,
      message: "Internal Server Error",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
  }
  return firstBearerToken;
}

async function getSecondBearerToken(firstBearerToken) {
  let secondBearerToken;
  try {
    const secondTokenResponse = await axios.post(
      `${constants.XENTE_BASE_URL}/auth/accounts/${constants.XENTE_ACCOUNT_ID}/login`,
      {},
      {
        headers: {
          Authorization: `Bearer ${firstBearerToken}`,
        },
      }
    );

    const statusCode = secondTokenResponse.status;

    if (statusCode === 401) {
      return {
        success: false,
        message: "Unauthorized",
        errors: { message: "Not Authorized" },
        status: httpStatus.UNAUTHORIZED,
      };
    }

    secondBearerToken = secondTokenResponse.data.token;
  } catch (error) {
    logObject("error", error);
    logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
    return {
      success: false,
      message: "Internal Server Error",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
  }
  return secondBearerToken;
}

const createTransaction = {
  /********************* HOST PAYMENTS **********************/
  sendMoneyToHost: async (request) => {
    try {
      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });
      const response = await api.post(
        `${constants.XENTE_BASE_URL}/transactions`,
        request
      );
      const { status, data } = response.data;
      const { requestId, batchId, transactionId } = data;
      const newRequestBody = {
        status,
        batch_id: batchId,
        ext_transaction_id: transactionId,
        request_id: requestId,
        amount: request.amount,
        host_id: request.host_id,
        description: "Transaction Successfully Completed",
      };

      const responseFromSaveTransaction = await TransactionModel(
        tenant
      ).register(newRequestBody);
      return responseFromSaveTransaction;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error --- ${JSON.stringify(error)}`);
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
      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });
      const response = await api.post(
        `${constants.XENTE_BASE_URL}/transactions`,
        request
      );
      const { status, data } = response.data;
      const { requestId, batchId, transactionId } = data;
      const newRequestBody = {
        status,
        batch_id: batchId,
        ext_transaction_id: transactionId,
        request_id: requestId,
        amount: request.amount,
        host_id: request.host_id,
        description: "Transaction Successfully Completed",
      };

      const responseFromSaveTransaction = await TransactionModel(
        tenant
      ).register(newRequestBody);
      return responseFromSaveTransaction;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error --- ${JSON.stringify(error)}`);
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
      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });
      const response = await api.post(
        `${constants.XENTE_BASE_URL}/transactions`,
        request
      );
      const { status, data } = response.data;
      const { requestId, batchId, transactionId } = data;
      const newRequestBody = {
        status,
        batch_id: batchId,
        ext_transaction_id: transactionId,
        request_id: requestId,
        amount: request.amount,
        host_id: request.host_id,
        description: "Transaction Successfully Completed",
      };

      const responseFromSaveTransaction = await TransactionModel(
        tenant
      ).register(newRequestBody);
      return responseFromSaveTransaction;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error --- ${JSON.stringify(error)}`);
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
      const { params } = request;
      const { transaction_id } = params;
      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });
      const url = `${constants.XENTE_BASE_URL}/core/transactions/${transaction_id}`;
      const response = await api.get(url);
      const data = response.data.data;
      return {
        success: true,
        message: "Successfully retrieved the data",
        data,
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error --- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  /************************** SIM CARD DATA LOADING **********************/
  loadDataBundle: async (request) => {
    try {
      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });
      const response = await api.post(
        `${constants.XENTE_BASE_URL}/transactions`,
        request
      );
      const { status, data } = response.data;
      const { requestId, batchId, transactionId } = data;
      const newRequestBody = {
        status,
        batch_id: batchId,
        ext_transaction_id: transactionId,
        request_id: requestId,
        amount: request.amount,
        host_id: request.host_id,
        description: "Transaction Successfully Completed",
      };
      const responseFromSaveTransaction = await TransactionModel(
        tenant
      ).register(newRequestBody);
      return responseFromSaveTransaction;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error --- ${JSON.stringify(error)}`);
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
      return {
        success: false,
        message: "Not Yet Implemented",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "Not Yet Implemented" },
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error --- ${JSON.stringify(error)}`);
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
