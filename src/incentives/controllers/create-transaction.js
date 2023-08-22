const httpStatus = require("http-status");
const { logObject, logText } = require("@utils/log");
const { validationResult } = require("express-validator");
const createTransactionUtil = require("@utils/create-transaction");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-transaction-controller`
);
const errors = require("@utils/errors");
const isEmpty = require("is-empty");

const createTransaction = {
  /******************************** HOST PAYMENTS *************************************************/
  sendMoneyToHost: async (req, res) => {
    logText("send money to host.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;

      const responseFromSendMoneyToHost =
        await createTransactionUtil.sendMoneyToHost(request);
      logObject(
        "responseFromSendMoneyToHost in controller",
        responseFromSendMoneyToHost
      );
      if (responseFromSendMoneyToHost.success === true) {
        const status = responseFromSendMoneyToHost.status
          ? responseFromSendMoneyToHost.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromSendMoneyToHost.message,
          transaction: responseFromSendMoneyToHost.data,
        });
      } else if (responseFromSendMoneyToHost.success === false) {
        const status = responseFromSendMoneyToHost.status
          ? responseFromSendMoneyToHost.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromSendMoneyToHost.message,
          errors: responseFromSendMoneyToHost.errors
            ? responseFromSendMoneyToHost.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  addMoneyToOrganisationAccount: async (req, res) => {
    logText("send money to host.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;

      const responseFromAddMoneyToOrganisation =
        await createTransactionUtil.addMoneyToOrganisationAccount(request);
      logObject(
        "responseFromAddMoneyToOrganisation in controller",
        responseFromAddMoneyToOrganisation
      );
      if (responseFromAddMoneyToOrganisation.success === true) {
        const status = responseFromAddMoneyToOrganisation.status
          ? responseFromAddMoneyToOrganisation.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAddMoneyToOrganisation.message,
          transaction: responseFromAddMoneyToOrganisation.data,
        });
      } else if (responseFromAddMoneyToOrganisation.success === false) {
        const status = responseFromAddMoneyToOrganisation.status
          ? responseFromAddMoneyToOrganisation.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAddMoneyToOrganisation.message,
          errors: responseFromAddMoneyToOrganisation.errors
            ? responseFromAddMoneyToOrganisation.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  receiveMoneyFromHost: async (req, res) => {
    logText("send money to host.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;

      const responseFromReceiveMoneyFromHost =
        await createTransactionUtil.receiveMoneyFromHost(request);
      logObject(
        "responseFromReceiveMoneyFromHost in controller",
        responseFromReceiveMoneyFromHost
      );
      if (responseFromReceiveMoneyFromHost.success === true) {
        const status = responseFromReceiveMoneyFromHost.status
          ? responseFromReceiveMoneyFromHost.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromReceiveMoneyFromHost.message,
          transaction: responseFromReceiveMoneyFromHost.data,
        });
      } else if (responseFromReceiveMoneyFromHost.success === false) {
        const status = responseFromReceiveMoneyFromHost.status
          ? responseFromReceiveMoneyFromHost.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromReceiveMoneyFromHost.message,
          errors: responseFromReceiveMoneyFromHost.errors
            ? responseFromReceiveMoneyFromHost.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  getTransactionDetails: async (req, res) => {
    logText("send money to host.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;

      const responseFromGetTransactionDetails =
        await createTransactionUtil.getTransactionDetails(request);
      logObject(
        "responseFromGetTransactionDetails in controller",
        responseFromGetTransactionDetails
      );
      if (responseFromGetTransactionDetails.success === true) {
        const status = responseFromGetTransactionDetails.status
          ? responseFromGetTransactionDetails.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromGetTransactionDetails.message,
          transaction: responseFromGetTransactionDetails.data,
        });
      } else if (responseFromGetTransactionDetails.success === false) {
        const status = responseFromGetTransactionDetails.status
          ? responseFromGetTransactionDetails.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromGetTransactionDetails.message,
          errors: responseFromGetTransactionDetails.errors
            ? responseFromGetTransactionDetails.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listTransactions: async (req, res) => {
    logText("send money to host.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;

      const responseFromListTransactions =
        await createTransactionUtil.listTransactions(request);
      logObject(
        "responseFromListTransactions in controller",
        responseFromListTransactions
      );
      if (responseFromListTransactions.success === true) {
        const status = responseFromListTransactions.status
          ? responseFromListTransactions.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListTransactions.message,
          transaction: responseFromListTransactions.data,
        });
      } else if (responseFromListTransactions.success === false) {
        const status = responseFromListTransactions.status
          ? responseFromListTransactions.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListTransactions.message,
          errors: responseFromListTransactions.errors
            ? responseFromListTransactions.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  /******************************** SIM CARD DATA LOADING *********************************/
  loadDataBundle: async (req, res) => {
    logText("send money to host.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;

      const responseFromLoadDataBundle =
        await createTransactionUtil.loadDataBundle(request);
      logObject(
        "responseFromLoadDataBundle in controller",
        responseFromLoadDataBundle
      );
      if (responseFromLoadDataBundle.success === true) {
        const status = responseFromLoadDataBundle.status
          ? responseFromLoadDataBundle.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromLoadDataBundle.message,
          transaction: responseFromLoadDataBundle.data,
        });
      } else if (responseFromLoadDataBundle.success === false) {
        const status = responseFromLoadDataBundle.status
          ? responseFromLoadDataBundle.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromLoadDataBundle.message,
          errors: responseFromLoadDataBundle.errors
            ? responseFromLoadDataBundle.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  checkRemainingDataBundleBalance: async (req, res) => {
    logText("send money to host.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            errors.convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return errors.badRequest(
          res,
          "bad request errors",
          errors.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        tenant = "airqo";
      }
      request.query.tenant = tenant;

      const responseFromCheckRemainingDataBundleBalance =
        await createTransactionUtil.checkRemainingDataBundleBalance(request);
      logObject(
        "responseFromCheckRemainingDataBundleBalance in controller",
        responseFromCheckRemainingDataBundleBalance
      );
      if (responseFromCheckRemainingDataBundleBalance.success === true) {
        const status = responseFromCheckRemainingDataBundleBalance.status
          ? responseFromCheckRemainingDataBundleBalance.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCheckRemainingDataBundleBalance.message,
          transaction: responseFromCheckRemainingDataBundleBalance.data,
        });
      } else if (
        responseFromCheckRemainingDataBundleBalance.success === false
      ) {
        const status = responseFromCheckRemainingDataBundleBalance.status
          ? responseFromCheckRemainingDataBundleBalance.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCheckRemainingDataBundleBalance.message,
          errors: responseFromCheckRemainingDataBundleBalance.errors
            ? responseFromCheckRemainingDataBundleBalance.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createTransaction;
