const scopeUtil = require("@utils/scope.util");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-scope-controller`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

/**
 * A higher-order function to create a controller method.
 * This abstracts away the repetitive try-catch, error handling, and response logic.
 * @param {Function} utilFunction - The utility function to be called (e.g., scopeUtil.createScope).
 * @param {string} dataKey - The key to use for the data in the success response (e.g., 'created_scope').
 * @returns {Function} An Express.js controller function.
 */
const createScopeController = (utilFunction, dataKey) => {
  return async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, errors)
        );
      }

      req.query.tenant =
        req.query.tenant || constants.DEFAULT_TENANT || "airqo";

      const result = await utilFunction(req, next);

      // If the util function called next(error), it will return undefined. Stop execution here.
      if (result === undefined || result === null) {
        return;
      }

      // Although next(error) doesn't set headers, this is a good safety check
      // in case a middleware sends a response and doesn't stop the chain.
      if (res.headersSent) {
        return;
      }

      if (result && result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          message: result.message ?? "Operation successful", // Default message
          [dataKey]: result.data ?? [],
        });
      } else {
        const status = result.status || httpStatus.INTERNAL_SERVER_ERROR;
        const message = result.message || "An unexpected error occurred";
        const errors = result.errors || { message };
        return res.status(status).json({ success: false, message, errors });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  };
};

module.exports = {
  create: createScopeController(scopeUtil.createScope, "created_scope"),
  list: createScopeController(scopeUtil.listScope, "scopes"),
  delete: createScopeController(scopeUtil.deleteScope, "deleted_scope"),
  update: createScopeController(scopeUtil.updateScope, "updated_scope"),
};
