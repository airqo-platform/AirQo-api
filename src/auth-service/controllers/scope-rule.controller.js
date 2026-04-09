const scopeRuleUtil = require("@utils/scope-rule.util");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- scope-rule-controller`);
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");

const createScopeRuleController = (utilFunction, dataKey) => {
  return async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(new HttpError("Bad Request", httpStatus.BAD_REQUEST, errors));
      }

      req.query.tenant = req.query.tenant || constants.DEFAULT_TENANT || "airqo";

      const result = await utilFunction(req, next);

      if (result === undefined || result === null) return;
      if (res.headersSent) return;

      if (result && result.success) {
        return res.status(result.status || httpStatus.OK).json({
          success: true,
          message: result.message ?? "Operation successful",
          [dataKey]: result.data ?? [],
          ...(result.meta && { meta: result.meta }),
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
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  };
};

module.exports = {
  create:       createScopeRuleController(scopeRuleUtil.createScopeRule,  "created_rule"),
  list:         createScopeRuleController(scopeRuleUtil.listScopeRules,   "rules"),
  update:       createScopeRuleController(scopeRuleUtil.updateScopeRule,  "updated_rule"),
  delete:       createScopeRuleController(scopeRuleUtil.deleteScopeRule,  "deleted_rule"),
  seedDefaults: createScopeRuleController(scopeRuleUtil.seedDefaultRules, "rules"),
};
