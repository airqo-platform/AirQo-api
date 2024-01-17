const TransactionModel = require("@models/transaction");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
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
const generateFilter = require("@utils/generate-filter");
const { HttpError } = require("@utils/errors");
const stringify = require("@utils/stringify");

/*********************************** Helper Functions ***********************************/
const createProductItemForMobileMoneyPayout = (phone_number) => {
  logObject("phone_number", phone_number);
  const airtelCodes = ["25675", "25670"];
  const mtnCodes = ["25678", "25677"];
  let paymentProvider;
  if (airtelCodes.some((code) => phone_number.toString().startsWith(code))) {
    paymentProvider = "AIRTELMOBILEMONEYPAYOUTUG_AIRTELMOBILEMONEYPAYOUTUG";
  } else if (
    mtnCodes.some((code) => phone_number.toString().startsWith(code))
  ) {
    paymentProvider = "MTNMOBILEMONEYPAYOUTUG_MTNMOBILEMONEYPAYOUTUG";
  }
  logObject("paymentProvider", paymentProvider);
  return paymentProvider;
};
const createPaymentProviderForCollections = (phone_number) => {
  const airtelCodes = ["25675", "25670"];
  const mtnCodes = ["25678", "25677"];
  let productItem;
  if (airtelCodes.some((code) => phone_number.toString().startsWith(code))) {
    productItem = "AIRTELMONEYUG";
  } else if (
    mtnCodes.some((code) => phone_number.toString().startsWith(code))
  ) {
    productItem = "MTNMOBILEMONEYUG";
  }
  return productItem;
};
const getFirstBearerToken = async () => {
  try {
    logObject("constants.XENTE_USERNAME", constants.XENTE_USERNAME);
    logObject("constants.XENTE_PASSWORD", constants.XENTE_PASSWORD);
    logObject("constants.XENTE_BASE_URL", constants.XENTE_BASE_URL);
    if (isEmpty(constants.XENTE_BASE_URL)) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message:
            "Unable to retrieve a crucial transaction configuration detail",
        },
      };
    }
    const url = `${constants.XENTE_BASE_URL}/auth/login`;
    logObject("url", url);

    return await axios
      .post(url, {
        email: constants.XENTE_USERNAME,
        password: constants.XENTE_PASSWORD,
      })
      .then((response) => {
        const statusCode = response.status;
        if (statusCode === 401) {
          return {
            success: false,
            message: "Unauthorized",
            errors: { message: "Not Authorized" },
            status: httpStatus.UNAUTHORIZED,
          };
        }
        const firstBearerToken = response.data.token;
        return firstBearerToken;
      })
      .catch((error) => {
        logger.error(
          `🐛🐛 internal server error --- getFirstBearerToken --- ${stringify(
            error
          )}`
        );
        if (error.response) {
          return {
            success: false,
            message: "Response status outised of 2XX range",
            errors: {
              message: "Response status outised of 2XX range",
              more: error.response.data.errors
                ? error.response.data.errors
                : "Response status outised of 2XX range",
            },
            status: error.response.status,
          };
        }
      });
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error --- getFirstBearerToken --- ${stringify(
        error
      )}`
    );
    return {
      success: false,
      message: "Internal Server Error",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
  }
};
const getSecondBearerToken = async (firstBearerToken) => {
  try {
    if (isEmpty(constants.XENTE_BASE_URL)) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message:
            "Unable to retrieve a crucial transaction configuration detail",
        },
      };
    }
    return await axios
      .post(
        `${constants.XENTE_BASE_URL}/auth/accounts/${constants.XENTE_ACCOUNT_ID}/login`,
        {},
        {
          headers: {
            Authorization: `Bearer ${firstBearerToken}`,
          },
        }
      )
      .then((response) => {
        const statusCode = response.status;
        if (statusCode === 401) {
          return {
            success: false,
            message: "Unauthorized",
            errors: { message: "Not Authorized" },
            status: httpStatus.UNAUTHORIZED,
          };
        }
        const secondBearerToken = response.data.token;
        return secondBearerToken;
      })
      .catch((error) => {
        logger.error(
          `🐛🐛 internal server error --- getSecondBearerToken --- ${stringify(
            error
          )}`
        );
        if (error.response) {
          return {
            success: false,
            message: "Response status outised of 2XX range",
            errors: {
              message: "Response status outised of 2XX range",
              more: error.response.data.errors
                ? error.response.data.errors
                : "Response status outised of 2XX range",
            },
            status: error.response.status,
          };
        }
      });
  } catch (error) {
    logger.error(
      `🐛🐛 Internal Server Error --- getSecondBearerToken --- ${stringify(
        error
      )}`
    );
    return {
      success: false,
      message: "Internal Server Error",
      status: httpStatus.INTERNAL_SERVER_ERROR,
      errors: { message: error.message },
    };
  }
};

const createTransaction = {
  /*********************************** HOST PAYMENTS ***********************************/
  sendMoneyToHost: async (request, next) => {
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

      logObject("host_id", host_id);

      const hostData = await HostModel(tenant)
        .findById(ObjectId(host_id))
        .lean();

      logObject("hostData", hostData);
      if (isEmpty(hostData) || isEmpty(hostData.phone_number)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "either Host does not exist or they do not have a registered phone number",
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
          amount: amount,
          productReference: stringify(phone_number),
          paymentReference: constants.XENTE_PAYOUTS_PAYMENT_REFERENCE,
          type: constants.XENTE_PAYOUTS_TYPE,
          batchId,
          requestId,
          metadata,
        };

        const firstBearerToken = await getFirstBearerToken();
        logObject("firstBearerToken", firstBearerToken);
        if (firstBearerToken.success === false) {
          return firstBearerToken;
        }
        const secondBearerToken = await getSecondBearerToken(firstBearerToken);
        logObject("secondBearerToken", secondBearerToken);
        if (secondBearerToken.success === false) {
          return secondBearerToken;
        }
        const api = axios.create({
          headers: {
            Authorization: `Bearer ${secondBearerToken}`,
          },
        });

        logObject("payHostRequestObject", payHostRequestObject);

        return await api
          .post(
            `${constants.XENTE_BASE_URL}/core/transactions`,
            payHostRequestObject
          )
          .then(async (response) => {
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
            ).register(transactionObjectForStorage, next);
            return responseFromSaveTransaction;
          })
          .catch((error) => {
            logObject("API request error", error);
            logger.error(
              `Response from EXT system, the status is outside of 2XX range --- sendMoneyToHost --- ${stringify(
                error
              )}`
            );
            if (error.response) {
              return {
                success: false,
                message: "Response status outside of 2XX range",
                errors: {
                  message:
                    "Response from EXT system, the status is outside of 2XX rangee",
                },
                status: error.response.status
                  ? error.response.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
              };
            } else if (error.request) {
              return {
                success: false,
                message: "No response received",
                errors: { message: "No response received" },
                status: error.response.status
                  ? error.response.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
              };
            } else {
              return {
                success: false,
                message: "Internal Server Error",
                errors: {
                  message:
                    "Response from EXT system, the status is outside of 2XX range",
                },
                status: error.response.status
                  ? error.response.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
              };
            }
          });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(
        `🐛🐛 Internal Server Error -- sendMoneyToHost -- ${stringify(error)}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  addMoneyToOrganisationAccount: async (request, next) => {
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

      const { tenant } = request.query;

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
        amount: stringify(amount),
        memo,
        channelId,
        customerId,
        customerPhone,
        customerEmail,
        productReference: constants.XENTE_COLLECTIONS_PRODUCT_REFERENCE,
        paymentReference: stringify(phone_number),
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
              `Response status outised of 2XX range --- addMoneyToOrganisationAccount --- ${stringify(
                error.response
              )}`
            );
            return {
              success: false,
              message: "Response status outised of 2XX range",
              errors: { message: "Response status outised of 2XX range" },
              status: error.response.status,
            };
          } else if (error.request) {
            logObject("No response received", error.request);
            logger.error(
              `🐛🐛 No response received --- addMoneyToOrganisationAccount --- ${stringify(
                error.request
              )}`
            );
            return {
              success: false,
              message: "No response received",
              errors: { message: "No response received" },
              status: error.response.status
                ? error.response.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          } else {
            logObject("Error", error.message);
            logger.error(
              `🐛🐛 Internal Server Error --- addMoneyToOrganisationAccount --- ${stringify(
                error
              )}`
            );
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: "Internal Server Error" },
              status: error.response.status
                ? error.response.status
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
      ).register(transactionObjectForStorage, next);
      return responseFromSaveTransaction;
    } catch (error) {
      logObject("error", error);
      logger.error(
        `🐛🐛 Internal Server Error -- addMoneyToOrganisationAccount -- ${stringify(
          error
        )}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  receiveMoneyFromHost: async (request, next) => {
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
          productItem: stringify(constants.XENTE_COLLECTIONS_PRODUCT_ITEM),
          amount: stringify(amount),
          memo,
          channelId,
          customerId,
          customerPhone,
          customerEmail,
          productReference: constants.XENTE_COLLECTIONS_PRODUCT_REFERENCE,
          paymentReference: stringify(phone_number),
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
                `Response status outised of 2XX range --- receiveMoneyFromHost --- ${stringify(
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
                `🐛🐛 No response received --- receiveMoneyFromHost --- ${stringify(
                  error.request
                )}`
              );
              return {
                success: false,
                message: "No response received",
                errors: { message: "No response received" },
                status: error.response.status
                  ? error.response.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
              };
            } else {
              logObject("Error", error.message);
              logger.error(
                `🐛🐛 Internal Server Error --- receiveMoneyFromHost --- ${stringify(
                  error
                )}`
              );
              return {
                success: false,
                message: "Internal Server Error",
                errors: { message: "Internal Server Error" },
                status: error.response.status
                  ? error.response.status
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
        ).register(transactionObjectForStorage, next);
        return responseFromSaveTransaction;
      }
    } catch (error) {
      logObject("error", error);
      logger.error(
        `🐛🐛 Internal Server Error -- receiveMoneyFromHost -- ${stringify(
          error
        )}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  getTransactionDetails: async (request, next) => {
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
            `Response status outised of 2XX range --- getTransactionDetails --- ${stringify(
              error.response
            )}`
          );
          return {
            success: false,
            message: "Response status outised of 2XX range",
            errors: { message: "Response status outised of 2XX range" },
            status: error.response.status,
          };
        } else if (error.request) {
          logObject("No response received", error.request);
          logger.error(
            `🐛🐛 No response received --- getTransactionDetails --- ${stringify(
              error.request
            )}`
          );
          return {
            success: false,
            message: "No response received",
            errors: { message: "No response received" },
            status: error.response.status
              ? error.response.status
              : httpStatus.INTERNAL_SERVER_ERROR,
          };
        } else {
          logObject("Error", error.message);
          logger.error(
            `🐛🐛 Internal Server Error --- getTransactionDetails --- ${stringify(
              error
            )}`
          );
          return {
            success: false,
            message: "Internal Server Error",
            errors: { message: "Internal Server Error" },
            status: error.response.status
              ? error.response.status
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
      logger.error(
        `🐛🐛 Internal Server Error -- getTransactionDetails -- ${stringify(
          error
        )}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listTransactions: async (request, next) => {
    logText("listTransactions.............");
    try {
      const filter = generateFilter.transactions(request, next);
      if (filter.success && filter.success === false) {
        return filter;
      }
      const { tenant } = request.query;
      const transactionDetails = await TransactionModel(tenant)
        .find(filter)
        .lean();
      return {
        success: true,
        message: "Successfully retrieved the transactions",
        data: transactionDetails ? transactionDetails : [],
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(
        `🐛🐛 Internal Server Error -- listTransactions -- ${stringify(error)}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  /********************************* SIM CARD DATA LOADING ************************************/
  loadDataBundle: async (request, next) => {
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
        productItem: stringify(product_item), //*
        amount: stringify(amount), //*
        productReference: stringify(phone_number), //*
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
              `Response status outised of 2XX range --- loadDataBundle --- ${stringify(
                error.response
              )}`
            );
            return {
              success: false,
              message: "Response status outised of 2XX range",
              errors: { message: "Response status outised of 2XX range" },
              status: error.response.status,
            };
          } else if (error.request) {
            logObject("No response received", error.request);
            logger.error(
              `🐛🐛 No response received --- loadDataBundle --- ${stringify(
                error.request
              )}`
            );
            return {
              success: false,
              message: "No response received",
              errors: { message: "No response received" },
              status: error.response.status
                ? error.response.status
                : httpStatus.INTERNAL_SERVER_ERROR,
            };
          } else {
            logObject("Error", error.message);
            logger.error(
              `🐛🐛 Internal Server Error --- loadDataBundle --- ${stringify(
                error
              )}`
            );
            return {
              success: false,
              message: "Internal Server Error",
              errors: { message: "Internal Server Error" },
              status: error.response.status
                ? error.response.status
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
      ).register(transactionObjectForStorage, next);
      return responseFromSaveTransaction;
    } catch (error) {
      logObject("error", error);
      logger.error(
        `🐛🐛 Internal Server Error -- loadDataBundle -- ${stringify(error)}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  checkRemainingDataBundleBalance: async (request, next) => {
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
      logger.error(
        `🐛🐛 Internal Server Error -- checkRemainingDataBundleBalance -- ${stringify(
          error
        )}`
      );
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = createTransaction;
