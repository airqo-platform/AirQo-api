const httpStatus = require("http-status");
const { logObject, logText } = require("@utils/log");
const createTransactionUtil = require("@utils/create-transaction");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-transaction-controller`
);
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");

const createTransaction = {
  /******************************** HOST PAYMENTS *************************************************/
  sendMoneyToHost: async (req, res, next) => {
    logText("send money to host.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromSendMoneyToHost =
        await createTransactionUtil.sendMoneyToHost(request, next);
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
      logger.error(`Internal Server Error ${error.message}`);
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
  addMoneyToOrganisationAccount: async (req, res, next) => {
    logText("send money to host.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromAddMoneyToOrganisation =
        await createTransactionUtil.addMoneyToOrganisationAccount(
          request,
          next
        );
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
      logger.error(`Internal Server Error ${error.message}`);
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
  receiveMoneyFromHost: async (req, res, next) => {
    logText("send money to host.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromReceiveMoneyFromHost =
        await createTransactionUtil.receiveMoneyFromHost(request, next);
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
      logger.error(`Internal Server Error ${error.message}`);
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
  getTransactionDetails: async (req, res, next) => {
    logText("send money to host.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromGetTransactionDetails =
        await createTransactionUtil.getTransactionDetails(request, next);
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
      logger.error(`Internal Server Error ${error.message}`);
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
  listTransactions: async (req, res, next) => {
    logText("send money to host.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListTransactions =
        await createTransactionUtil.listTransactions(request, next);
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
      logger.error(`Internal Server Error ${error.message}`);
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
  /******************************** SIM CARD DATA LOADING *********************************/
  loadDataBundle: async (req, res, next) => {
    logText("send money to host.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromLoadDataBundle =
        await createTransactionUtil.loadDataBundle(request, next);
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
      logger.error(`Internal Server Error ${error.message}`);
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
  checkRemainingDataBundleBalance: async (req, res, next) => {
    logText("send money to host.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCheckRemainingDataBundleBalance =
        await createTransactionUtil.checkRemainingDataBundleBalance(
          request,
          next
        );
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
      logger.error(`Internal Server Error ${error.message}`);
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
