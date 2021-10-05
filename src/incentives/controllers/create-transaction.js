const HTTPStatus = require("http-status");
const { logObject, logElement, logText } = require("../utils/log");
const { validationResult } = require("express-validator");
const { tryCatchErrors, badRequest } = require("../utils/errors");
const createTransactionUtil = require("../utils/create-transaction");
const log4js = require("log4js");
const logger = log4js.getLogger("create-transaction-util");
const transformDataUtil = require("../utils/transform-data");

const createTransaction = {
  softRegister: async (req, res) => {
    let request = {};
    let { body } = req;
    let { query } = req;
    logText("registering transaction.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      request["body"] = body;
      request["query"] = query;

      let responseFromCreateTransaction =
        await createTransactionUtil.softCreate(request);
      logObject(
        "responseFromCreateTransaction in controller",
        responseFromCreateTransaction
      );
      if (responseFromCreateTransaction.success === true) {
        let status = responseFromCreateTransaction.status
          ? responseFromCreateTransaction.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateTransaction.message,
          created_transaction: responseFromCreateTransaction.data,
        });
      }

      if (responseFromCreateTransaction.success === false) {
        let status = responseFromCreateTransaction.status
          ? responseFromCreateTransaction.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromCreateTransaction.errors
          ? responseFromCreateTransaction.errors
          : "";

        return res.status(status).json({
          success: false,
          message: responseFromCreateTransaction.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  register: async (req, res) => {
    return res.status(HTTPStatus.NOT_IMPLEMENTED).json({
      message: "coming soon",
      success: false,
    });
    let request = {};
    let { body } = req;
    let { query } = req;
    logText("registering transaction.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      request["body"] = body;
      request["query"] = query;

      let responseFromCreateTransaction = await createTransactionUtil.create(
        request
      );
      logObject(
        "responseFromCreateTransaction in controller",
        responseFromCreateTransaction
      );
      if (responseFromCreateTransaction.success === true) {
        let status = responseFromCreateTransaction.status
          ? responseFromCreateTransaction.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateTransaction.message,
          transaction: responseFromCreateTransaction.data,
        });
      }

      if (responseFromCreateTransaction.success === false) {
        let status = responseFromCreateTransaction.status
          ? responseFromCreateTransaction.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromCreateTransaction.errors
          ? responseFromCreateTransaction.errors
          : "";

        return res.status(status).json({
          success: false,
          message: responseFromCreateTransaction.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  registerMomoMTN: async (req, res) => {
    try {
      let request = {};
      const responseFromCreateMomo = await createTransactionUtil.createMomoMTN(
        request
      );
      logObject("responseFromCreateMomo", responseFromCreateMomo);
      if (responseFromCreateMomo.success === true) {
        const status = responseFromCreateMomo.status
          ? responseFromCreateMomo.status
          : HTTPStatus.OK;
        const data = responseFromCreateMomo.data
          ? responseFromCreateMomo.data
          : "";
        return res.status(status).json({
          success: true,
          message: responseFromCreateMomo.message,
          data,
        });
      }

      if (responseFromCreateMomo.success === false) {
        const status = responseFromCreateMomo.status
          ? responseFromCreateMomo.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromCreateMomo.errors
          ? responseFromCreateMomo.errors
          : "";
        return res.status(status).json({
          success: false,
          message: "Internal Server Error",
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        errors: { message: error.message },
        message: "Internal Server Error",
        success: false,
      });
    }
  },

  update: async (req, res) => {
    try {
      let request = {};
      let { body } = req;
      let { query } = req;
      logText("updating transaction................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["body"] = body;
      request["query"] = query;
      let responseFromUpdateTransaction = await createTransactionUtil.update(
        request
      );
      logObject("responseFromUpdateTransaction", responseFromUpdateTransaction);
      if (responseFromUpdateTransaction.success === true) {
        let status = responseFromUpdateTransaction.status
          ? responseFromUpdateTransaction.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateTransaction.message,
          updated_transaction: responseFromUpdateTransaction.data,
        });
      }

      if (responseFromUpdateTransaction.success === false) {
        let errors = responseFromUpdateTransaction.errors
          ? responseFromUpdateTransaction.errors
          : "";

        let status = responseFromUpdateTransaction.status
          ? responseFromUpdateTransaction.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateTransaction.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      const { query } = req;
      let request = {};
      logText(".....................................");
      logText("list all transactions by query params provided");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      let responseFromListTransactions = await createTransactionUtil.list(
        request
      );
      logElement(
        "has the response for listing transactions been successful?",
        responseFromListTransactions.success
      );
      if (responseFromListTransactions.success === true) {
        let status = responseFromListTransactions.status
          ? responseFromListTransactions.status
          : HTTPStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListTransactions.message,
          transactions: responseFromListTransactions.data,
        });
      }

      if (responseFromListTransactions.success === false) {
        let errors = responseFromListTransactions.errors
          ? responseFromListTransactions.errors
          : "";
        let status = responseFromListTransactions.status
          ? responseFromListTransactions.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromListTransactions.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      const { body } = req;
      let request = {};
      logText(".................................................");
      logText("inside delete transaction............");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          transformDataUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      request["query"] = query;
      request["body"] = body;
      let responseFromRemoveTransaction = await createTransactionUtil.delete(
        request
      );

      if (responseFromRemoveTransaction.success === true) {
        let status = responseFromRemoveTransaction.status
          ? responseFromRemoveTransaction.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveTransaction.message,
          deleted_transaction: responseFromRemoveTransaction.data,
        });
      }

      if (responseFromRemoveTransaction.success === false) {
        let errors = responseFromRemoveTransaction.errors
          ? responseFromRemoveTransaction.errors
          : "";
        let status = responseFromRemoveTransaction.status
          ? responseFromRemoveTransaction.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRemoveTransaction.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createTransaction;
