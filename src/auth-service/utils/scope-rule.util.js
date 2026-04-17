const ScopeRuleModel = require("@models/ScopeRule");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- scope-rule-util`);

const scopeRule = {
  createScopeRule: async (request, next) => {
    try {
      const { query, body } = request;
      const tenant = (query.tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase();
      return await ScopeRuleModel(tenant).register(body, next);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        return next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
      }
      throw error;
    }
  },

  listScopeRules: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.scope_rules(request, next);
      return await ScopeRuleModel((tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase()).list(
        { skip, limit, filter },
        next
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        return next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
      }
      throw error;
    }
  },

  updateScopeRule: async (request, next) => {
    try {
      const { query, body, params } = request;
      const tenant = (query.tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase();
      const filter = { _id: params.rule_id };
      return await ScopeRuleModel(tenant).modify({ filter, update: body }, next);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        return next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
      }
      throw error;
    }
  },

  deleteScopeRule: async (request, next) => {
    try {
      const { query, params } = request;
      const tenant = (query.tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase();
      const filter = { _id: params.rule_id };
      return await ScopeRuleModel(tenant).remove({ filter }, next);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        return next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
      }
      throw error;
    }
  },

  seedDefaultRules: async (request, next) => {
    try {
      const { query } = request;
      const tenant = (query.tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase();
      return await ScopeRuleModel(tenant).seedDefaults(next);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        return next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
      }
      throw error;
    }
  },
};

module.exports = scopeRule;
