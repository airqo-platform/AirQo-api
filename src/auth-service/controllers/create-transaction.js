const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transaction-controller`
);
const transactionsUtil = require("@utils/create-transaction");

const transactions = {
  createCheckoutSession: async (req, res, next) => {
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

      const { amount, currency, customerId, items } =
        request.validatedtransaction;

      const result = await transactionsUtil.createCheckoutSession({
        items: items || [
          {
            price: await transactionsUtil.getDynamicPriceId(amount, currency),
            quantity: 1,
          },
        ],
        customer: {
          id: customerId,
        },
        custom_data: {
          source: "web_donation",
          initial_amount: amount,
        },
        settings: {
          mode: "transaction",
          success_url: process.env.PADDLE_SUCCESS_REDIRECT_URL,
          cancel_url: process.env.PADDLE_CANCEL_REDIRECT_URL,
        },
      });

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.CREATED;
        return res.status(status).json({
          success: true,
          message: "Checkout session created successfully",
          session_url: result.data.url,
          session_id: result.data.id,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message ? result.message : "",
          errors: result.errors
            ? result.errors
            : { message: "transaction session creation failed" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

  handleWebhook: async (req, res, next) => {
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

      // Verify and process webhook
      const result = await transactionsUtil.processWebhook(request);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message ? result.message : "Webhook processed",
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message ? result.message : "",
          errors: result.errors
            ? result.errors
            : { message: "Webhook processing failed" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

  listTransactions: async (req, res, next) => {},
  updateTransaction: async (req, res, next) => {},
  getTransactionStats: async (req, res, next) => {},
  deleteTransaction: async (req, res, next) => {},
};

module.exports = transactions;
