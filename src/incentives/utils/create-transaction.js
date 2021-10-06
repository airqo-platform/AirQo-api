const TransactionModel = require("../models/Transaction");
const constants = require("../config/constants");
const { logObject, logElement, logText } = require("./log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const generateFilter = require("./generate-filter");
const log4js = require("log4js");
const httpStatus = require("http-status");
const logger = log4js.getLogger("create-transaction-util");
const mtnMomoDisbursements = require("../config/momo-disbursement");
const createHostUtil = require("./create-host");

const createTransaction = {
  softCreate: async (request) => {
    try {
      let { body } = request;
      let { tenant } = request.query;
      logObject("body", body);

      let responseFromRegisterTransaction = await TransactionModel(
        tenant
      ).register(body);

      logObject(
        "responseFromRegisterTransaction",
        responseFromRegisterTransaction
      );

      if (responseFromRegisterTransaction.success === true) {
        const status = responseFromRegisterTransaction.status
          ? responseFromRegisterTransaction.status
          : "";
        return {
          success: true,
          message: responseFromRegisterTransaction.message,
          data: responseFromRegisterTransaction.data,
          status,
        };
      }

      if (responseFromRegisterTransaction.success === false) {
        const errors = responseFromRegisterTransaction.errors
          ? responseFromRegisterTransaction.errors
          : "";

        const status = responseFromRegisterTransaction.status
          ? responseFromRegisterTransaction.status
          : "";

        return {
          success: false,
          message: responseFromRegisterTransaction.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement(" the util server error,", err.message);
      return {
        success: false,
        message: "unable to create transaction",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: err.message },
      };
    }
  },

  create: async (request) => {
    try {
      let { body } = request;
      logObject("body", body);

      let responseFromCreateMOMOTransaction = {};

      logObject(
        "responseFromCreateMOMOTransaction",
        responseFromCreateMOMOTransaction
      );

      if (responseFromCreateMOMOTransaction.success === true) {
        const responseFromCreateTransaction =
          await createTransaction.softCreate(request);

        if (responseFromCreateTransaction.success === true) {
          const status = responseFromCreateTransaction.status
            ? responseFromCreateTransaction.status
            : "";
          const data = responseFromCreateTransaction.data;
          return {
            success: true,
            status,
            data,
            message: "successfully created the transaction",
          };
        }

        if (responseFromCreateTransaction.success === false) {
          const status = responseFromCreateTransaction.status
            ? responseFromCreateTransaction.status
            : "";
          const errors = responseFromCreateTransaction.errors
            ? responseFromCreateTransaction.errors
            : "";
          return {
            success: false,
            status,
            errors,
          };
        }
      }

      if (responseFromCreateMOMOTransaction.success === false) {
        const errors = responseFromCreateMOMOTransaction.errors
          ? responseFromCreateMOMOTransaction.errors
          : "";

        const status = responseFromCreateMOMOTransaction.status
          ? responseFromCreateMOMOTransaction.status
          : "";

        return {
          success: false,
          message: responseFromCreateMOMOTransaction.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement(" the util server error,", err.message);
      return {
        success: false,
        message: "unable to create transaction",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: { message: err.message },
      };
    }
  },
  retrievePhoneNumbers: async (request) => {
    const { body, query } = request;
    const { hosts } = body;
    let phoneNumbers = [];
    let failedHosts = [];
    let success = "";
    let message = "";
    let errors = {};
    let status = "";

    hosts.forEach(async (host_id) => {
      let modifiedRequest = request;
      modifiedRequest["query"]["id"] = host_id;
      let responseFromListHost = await createHostUtil.list(modifiedRequest);

      logObject("responseFromListHost", responseFromListHost);

      if (responseFromListHost.success === true) {
        let data = responseFromListHost.data;
        if (data.length > 1) {
          failedHosts.push(host_id);
          logElement(
            "received more than one document for this host search",
            host_id
          );
        }
        let phoneNumber = data[0].phone_number;
        logElement("the phone number", phoneNumber);
        phoneNumbers.push(phoneNumber);
        success = true;
        message = "successfully retrieved some phone numbers";
        (status = httpStatus.OK), logObject("phoneNumbers", phoneNumbers);
      }

      if (responseFromListHost.success === false) {
        logObject("unable to retrieve host details", responseFromListHost);
        failedHosts.push(host_id);
        success = false;
        message = "unable to retrieve host details";
        errors = responseFromListHost.errors;
        status = httpStatus.INTERNAL_SERVER_ERROR;
      }
    });
    let response = {
      success,
      message,
      data: phoneNumbers,
      status,
      errors,
    };
    return response;
  },
  createMomoMTN: async (request) => {
    try {
      const { body } = request;
      const { amount, currency, phoneNumber, hosts, description } = body;
      let response = {};

      const responseFromRetrievePhoneNumbers =
        await createTransaction.retrievePhoneNumbers(request);

      logObject(
        "responseFromRetrievePhoneNumbers",
        responseFromRetrievePhoneNumbers
      );

      if (responseFromRetrievePhoneNumbers.success === true) {
        const phoneNumbers = responseFromRetrievePhoneNumbers.data;
        phoneNumbers.forEach((value) => {
          mtnMomoDisbursements
            .transfer({
              amount,
              currency,
              externalId: "947354",
              payee: {
                partyIdType: "MSISDN",
                partyId: value,
              },
              payerMessage: "testing",
              payeeNote: "hello",
              callbackUrl: "https://75f59b50.ngrok.io",
            })
            .then((transactionId) => {
              console.log({ transactionId });
              // Get transaction status
              response["transaction_id"] = transactionId;
              const status = mtnMomoDisbursements.getTransaction(transactionId);
              logObject("status", status);
              response["status"] = status;
              return status;
            })
            .then((transaction) => {
              console.log({ transaction });
              const balance = mtnMomoDisbursements.getBalance();
              response["balance"] = balance;
              return balance;
            })
            .then((accountBalance) => {
              console.log({ accountBalance });
              response["success"] = true;
            })
            .catch((error) => {
              response["success"] = false;
              response["errors"] = {
                message: error,
              };
              console.log(error);
            });
        });
      }

      if (responseFromRetrievePhoneNumbers.success === false) {
        return responseFromRetrievePhoneNumbers;
      }
      logObject("Creating MOMO MTN response", response);
      return response;
    } catch (error) {
      return {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
        success: false,
      };
    }
  },
  update: async (request) => {
    try {
      let { query } = request;
      let { body } = request;
      let { tenant } = query;

      let update = body;
      let filter = generateFilter.transactions(request);

      let responseFromModifyTransaction = await TransactionModel(tenant).modify(
        {
          filter,
          update,
        }
      );

      if (responseFromModifyTransaction.success === true) {
        let status = responseFromModifyTransaction.status
          ? responseFromModifyTransaction.status
          : "";
        return {
          success: true,
          message: responseFromModifyTransaction.message,
          data: responseFromModifyTransaction.data,
          status,
        };
      }

      if (responseFromModifyTransaction.success === false) {
        const errors = responseFromModifyTransaction.errors
          ? responseFromModifyTransaction.errors
          : "";

        const status = responseFromModifyTransaction.status
          ? responseFromModifyTransaction.status
          : "";

        return {
          success: false,
          message: responseFromModifyTransaction.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("update Transactions util", err.message);
      return {
        success: false,
        message: "unable to update transaction",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      let filter = generateFilter.transactions(request);
      let responseFromRemoveTransaction = await TransactionModel(tenant).remove(
        {
          filter,
        }
      );

      if (responseFromRemoveTransaction.success === true) {
        let status = responseFromRemoveTransaction.status
          ? responseFromRemoveTransaction.status
          : "";
        return {
          success: true,
          message: responseFromRemoveTransaction.message,
          data: responseFromRemoveTransaction.data,
          status,
        };
      }

      if (responseFromRemoveTransaction.success === false) {
        const errors = responseFromRemoveTransaction.errors
          ? responseFromRemoveTransaction.errors
          : "";

        const status = responseFromRemoveTransaction.status
          ? responseFromRemoveTransaction.status
          : "";

        return {
          success: false,
          message: responseFromRemoveTransaction.message,
          errors,
          status,
        };
      }
    } catch (err) {
      logElement("delete Transaction util", err.message);
      return {
        success: false,
        message: "unable to delete transaction",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      let { query } = request;
      let { tenant } = query;
      const limit = 1000;
      const skip = parseInt(query.skip) || 0;
      let filter = generateFilter.transactions(request);
      logObject("filter", filter);

      let responseFromListTransaction = await TransactionModel(tenant).list({
        filter,
        limit,
        skip,
      });

      logObject("responseFromListTransaction", responseFromListTransaction);
      if (responseFromListTransaction.success === false) {
        const errors = responseFromListTransaction.errors
          ? responseFromListTransaction.errors
          : "";

        const status = responseFromListTransaction.status
          ? responseFromListTransaction.status
          : "";
        return {
          success: false,
          message: responseFromListTransaction.message,
          errors,
          status,
        };
      }

      if (responseFromListTransaction.success === true) {
        const status = responseFromListTransaction.status
          ? responseFromListTransaction.status
          : "";
        const data = responseFromListTransaction.data;
        return {
          success: true,
          message: responseFromListTransaction.message,
          data,
          status,
        };
      }
    } catch (err) {
      logElement("list Transactions util", err.message);
      return {
        success: false,
        message: "unable to list transaction",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = createTransaction;
