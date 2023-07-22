const TransactionModel = require("@models/transaction");
const HostModel = require("@models/Host");
const constants = require("@config/constants");
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-transaction-util`
);
const axios = require("axios");

/*********************************** Helper Functions ***********************************/
function createProductItemForMobileMoneyPayout(phone_number) {
  const airtelCodes = ["075", "070"];
  const mtnCodes = ["078", "077"];
  let paymentProvider;
  if (airtelCodes.some((code) => phone_number.startsWith(code))) {
    paymentProvider = "AIRTELMOBILEMONEYPAYOUTUG_AIRTELMOBILEMONEYPAYOUTUG";
  } else if (mtnCodes.some((code) => phone_number.startsWith(code))) {
    paymentProvider = "MTNMOBILEMONEYPAYOUTUG_MTNMOBILEMONEYPAYOUTUG";
  }
  const result = {
    paymentProvider,
  };
  return result;
}
function createPaymentProviderForCollections(phone_number) {
  const airtelCodes = ["075", "070"];
  const mtnCodes = ["078", "077"];
  let productItem;
  if (airtelCodes.some((code) => phone_number.startsWith(code))) {
    productItem = "AIRTELMONEYUG";
  } else if (mtnCodes.some((code) => phone_number.startsWith(code))) {
    productItem = "MTNMOBILEMONEYUG";
  }
  const result = {
    productItem,
  };
  return result;
}
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
  /*********************************** HOST PAYMENTS ***********************************/
  sendMoneyToHost: async (request) => {
    try {
      const {
        amount, //*
        channelId,
        customerId,
        customerPhone,
        customerEmail,
        memo,
        batchId,
        requestId,
        metadata,
      } = request.body;

      const { host_id } = request.params; //*
      const { tenant } = request.query;

      const hostData = await HostModel(tenant)
        .find({ _id: ObjectId(host_id) })
        .lean();

      if (isEmpty(hostData) || isEmpty(hostData.phone_number)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "either Host does not exist of they do not have a registered phone number",
          },
        };
      } else {
        const phone_number = hostData.phone_number;
        const payHostRequestObject = {
          channelId,
          customerId,
          customerPhone,
          customerEmail,
          memo,
          paymentProvider: constants.XENTE_PAYOUTS_PAYMENT_PROVIDER,
          productItem: createProductItemForMobileMoneyPayout(phone_number),
          amount: JSON.stringify(amount),
          productReference: JSON.stringify(phone_number),
          paymentReference: constants.XENTE_PAYOUTS_PAYMENT_REFERENCE,
          type: constants.XENTE_PAYOUTS_TYPE,
          batchId,
          requestId,
          metadata,
        };

        const firstBearerToken = await getFirstBearerToken();
        const secondBearerToken = await getSecondBearerToken(firstBearerToken);
        const api = axios.create({
          headers: {
            Authorization: `Bearer ${secondBearerToken}`,
          },
        });

        const response = await api
          .post(
            `${constants.XENTE_BASE_URL}/transactions`,
            payHostRequestObject
          )
          .catch((error) => {
            logObject("API request error", error);
            if (error.response) {
              logObject(
                "Response status outised of 2XX range:",
                error.response.status
              );
              logObject("Response data", error.response.data);
              logger.error(
                `Response status outised of 2XX range -- ${JSON.stringify(
                  error.response
                )}`
              );
              return {
                success: false,
                message: "Response status outised of 2XX range",
                errors: { message: "Response status outised of 2XX range" },
                status: response.status,
              };
            } else if (error.request) {
              logObject("No response received", error.request);
              logger.error(
                `No response received -- ${JSON.stringify(error.request)}`
              );
              return {
                success: false,
                message: "No response received",
                errors: { message: "No response received" },
                status: response.status
                  ? response.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
              };
            } else {
              logObject("Error", error.message);
              logger.error(`Error -- ${JSON.stringify(error.message)}`);
              return {
                success: false,
                message: "Internal Server Error",
                errors: { message: "Internal Server Error" },
                status: response.status
                  ? response.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
              };
            }
          });
        const { status, data } = response.data;
        const { transactionId } = data;

        const transactionObjectForStorage = {
          status,
          batch_id: batchId,
          ext_transaction_id: transactionId,
          request_id: requestId,
          amount,
          host_id,
          description: "Transaction Successfully Completed",
        };

        const responseFromSaveTransaction = await TransactionModel(
          tenant
        ).register(transactionObjectForStorage);
        return responseFromSaveTransaction;
      }
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
      const {
        amount, //*
        phone_number, //*
        channelId,
        customerId,
        customerPhone,
        customerEmail,
        memo,
        batchId,
        requestId,
        metadata,
      } = request.body;

      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });

      const collectMoneyRequestBody = {
        paymentProvider: createPaymentProviderForCollections(phone_number),
        productItem: constants.XENTE_COLLECTIONS_PRODUCT_ITEM,
        amount: JSON.stringify(amount),
        memo,
        channelId,
        customerId,
        customerPhone,
        customerEmail,
        productReference: constants.XENTE_COLLECTIONS_PRODUCT_REFERENCE,
        paymentReference: JSON.stringify(phone_number),
        type: constants.XENTE_C0LLECTIONS_TYPE,
        metadata,
        batchId,
        requestId,
      };

      const response = await api
        .post(
          `${constants.XENTE_BASE_URL}/transactions`,
          collectMoneyRequestBody
        )
        .catch((error) => {
          logObject("API request error", error);
          if (error.response) {
            logObject(
              "Response status outised of 2XX range:",
              error.response.status
            );
            logObject("Response data", error.response.data);
            logger.error(
              `Response status outised of 2XX range -- ${JSON.stringify(
                error.response
              )}`
            );
            return {
              success: false,
              message: "Response status outised of 2XX range",
              errors: { message: "Response status outised of 2XX range" },
              status: response.status,
            };
          } else if (error.request) {
            logObject("No response received", error.request);
            logger.error(
              `No response received -- ${JSON.stringify(error.request)}`
            );
            return {
              success: false,
              message: "No response received",
              errors: { message: "No response received" },
              status: response.status
                ? response.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          } else {
            logObject("Error", error.message);
            logger.error(`Error -- ${JSON.stringify(error.message)}`);
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: "Internal Server Error" },
              status: response.status
                ? response.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        });
      const { status, data } = response.data;
      const { transactionId } = data;

      const transactionObjectForStorage = {
        status,
        batch_id: batchId,
        ext_transaction_id: transactionId,
        request_id: requestId,
        amount,
        description: "Transaction Successfully Completed",
      };

      const responseFromSaveTransaction = await TransactionModel(
        tenant
      ).register(transactionObjectForStorage);
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
      const {
        amount, //*
        host_id, //*
        channelId,
        customerId,
        customerPhone,
        customerEmail,
        memo,
        batchId,
        requestId,
        metadata,
      } = request.body;

      const { tenant } = request.query;

      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });

      const hostDetails = await HostModel(tenant)
        .find({
          _id: ObjectId(host_id),
        })
        .lean();

      if (isEmpty(hostDetails) || isEmpty(hostDetails.phone_number)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "Either Host does not exist of they do not have a registered phone number",
          },
        };
      } else {
        const collectMoneyRequestBody = {
          paymentProvider: createPaymentProviderForCollections(phone_number),
          productItem: JSON.stringify(constants.XENTE_COLLECTIONS_PRODUCT_ITEM),
          amount: JSON.stringify(amount),
          memo,
          channelId,
          customerId,
          customerPhone,
          customerEmail,
          productReference: constants.XENTE_COLLECTIONS_PRODUCT_REFERENCE,
          paymentReference: JSON.stringify(phone_number),
          type: constants.XENTE_C0LLECTIONS_TYPE,
          metadata,
          batchId,
          requestId,
        };

        const response = await api
          .post(
            `${constants.XENTE_BASE_URL}/transactions`,
            collectMoneyRequestBody
          )
          .catch((error) => {
            logObject("API request error", error);
            if (error.response) {
              logObject(
                "Response status outised of 2XX range:",
                error.response.status
              );
              logObject("Response data", error.response.data);
              logger.error(
                `Response status outised of 2XX range -- ${JSON.stringify(
                  error.response
                )}`
              );
              return {
                success: false,
                message: "Response status outised of 2XX range",
                errors: { message: "Response status outised of 2XX range" },
                status: response.status,
              };
            } else if (error.request) {
              logObject("No response received", error.request);
              logger.error(
                `No response received -- ${JSON.stringify(error.request)}`
              );
              return {
                success: false,
                message: "No response received",
                errors: { message: "No response received" },
                status: response.status
                  ? response.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
              };
            } else {
              logObject("Error", error.message);
              logger.error(`Error -- ${JSON.stringify(error.message)}`);
              return {
                success: false,
                message: "Internal Server Error",
                errors: { message: "Internal Server Error" },
                status: response.status
                  ? response.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
              };
            }
          });
        const { status, data } = response.data;
        const { transactionId } = data;
        const transactionObjectForStorage = {
          status,
          batch_id: batchId,
          ext_transaction_id: transactionId,
          request_id: requestId,
          amount,
          host_id,
          description: "Transaction Successfully Completed",
        };

        const responseFromSaveTransaction = await TransactionModel(
          tenant
        ).register(transactionObjectForStorage);
        return responseFromSaveTransaction;
      }
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
      const { transaction_id } = params; //*
      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });
      const url = `${constants.XENTE_BASE_URL}/core/transactions/${transaction_id}`;
      const response = await api.get(url).catch((error) => {
        logObject("API request error", error);
        if (error.response) {
          logObject(
            "Response status outised of 2XX range:",
            error.response.status
          );
          logObject("Response data", error.response.data);
          logger.error(
            `Response status outised of 2XX range -- ${JSON.stringify(
              error.response
            )}`
          );
          return {
            success: false,
            message: "Response status outised of 2XX range",
            errors: { message: "Response status outised of 2XX range" },
            status: response.status,
          };
        } else if (error.request) {
          logObject("No response received", error.request);
          logger.error(
            `No response received -- ${JSON.stringify(error.request)}`
          );
          return {
            success: false,
            message: "No response received",
            errors: { message: "No response received" },
            status: response.status
              ? response.status
              : httpStatus.INTERNAL_SERVER_ERROR,
          };
        } else {
          logObject("Error", error.message);
          logger.error(`Error -- ${JSON.stringify(error.message)}`);
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: "Internal Server Error" },
            status: response.status
              ? response.status
              : httpStatus.INTERNAL_SERVER_ERROR,
          };
        }
      });
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
  /********************************* SIM CARD DATA LOADING ************************************/
  loadDataBundle: async (request) => {
    try {
      const {
        amount, //*
        phone_number, //*
        product_item, //*
        channelId,
        customerId,
        customerPhone,
        customerEmail,
        memo,
        batchId,
        requestId,
        metadata,
      } = request.body;
      const { tenant } = request.query;
      const firstBearerToken = await getFirstBearerToken();
      const secondBearerToken = await getSecondBearerToken(firstBearerToken);
      const api = axios.create({
        headers: {
          Authorization: `Bearer ${secondBearerToken}`,
        },
      });

      const loadDataRequestObject = {
        paymentProvider: constants.XENTE_DATA_PAYMENT_PROVIDER,
        productItem: JSON.stringify(product_item), //*
        amount: JSON.stringify(amount), //*
        productReference: JSON.stringify(phone_number), //*
        paymentReference: constants.XENTE_DATA_PAYMENT_REFERENCE,
        type: constants.XENTE_DATA_TYPE,
        batchId,
        requestId,
        metadata,
        memo,
        channelId,
        customerId,
        customerPhone,
        customerEmail,
      };

      const response = await api
        .post(`${constants.XENTE_BASE_URL}/transactions`, loadDataRequestObject)
        .catch((error) => {
          logObject("API request error", error);
          if (error.response) {
            logObject(
              "Response status outised of 2XX range:",
              error.response.status
            );
            logObject("Response data", error.response.data);
            logger.error(
              `Response status outised of 2XX range -- ${JSON.stringify(
                error.response
              )}`
            );
            return {
              success: false,
              message: "Response status outised of 2XX range",
              errors: { message: "Response status outised of 2XX range" },
              status: response.status,
            };
          } else if (error.request) {
            logObject("No response received", error.request);
            logger.error(
              `No response received -- ${JSON.stringify(error.request)}`
            );
            return {
              success: false,
              message: "No response received",
              errors: { message: "No response received" },
              status: response.status
                ? response.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          } else {
            logObject("Error", error.message);
            logger.error(`Error -- ${JSON.stringify(error.message)}`);
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: "Internal Server Error" },
              status: response.status
                ? response.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          }
        });
      const { status, data } = response.data;
      const { transactionId } = data;
      const transactionObjectForStorage = {
        status,
        batch_id: batchId,
        ext_transaction_id: transactionId,
        request_id: requestId,
        amount,
        description: "Transaction Successfully Completed",
      };
      const responseFromSaveTransaction = await TransactionModel(
        tenant
      ).register(transactionObjectForStorage);
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
      const { device_id } = request.params;
      /**
       * We shall find a way of connecting to the Device Registry
       * To enable access to it as a way of getting device details
       * and there after extracting the phoneNumber details of the device
       */
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
