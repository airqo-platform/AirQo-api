const ScopeModel = require("@models/Scope");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { generateFilter } = require("@utils/common");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- scope-util`);

const scope = {
  updateScope: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.scopes(request, next);
      const update = Object.assign({}, body);
      const responseFromUpdateToken = await ScopeModel(
        tenant.toLowerCase()
      ).modify({ filter, update }, next);
      return responseFromUpdateToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw new Error(`Error processing scope update: ${error.message}`);
      }
    }
  },
  deleteScope: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.scopes(request, next);
      const responseFromDeleteToken = await ScopeModel(
        tenant.toLowerCase()
      ).remove({ filter }, next);
      return responseFromDeleteToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw new Error(`Error processing scope deletion: ${error.message}`);
      }
    }
  },
  listScope: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.scopes(request, next);
      const responseFromListToken = await ScopeModel(tenant.toLowerCase()).list(
        { skip, limit, filter },
        next
      );
      return responseFromListToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw new Error(`Error processing scope read: ${error.message}`);
      }
    }
  },
  createScope: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const responseFromCreateToken = await ScopeModel(
        tenant.toLowerCase()
      ).register(body, next);
      return responseFromCreateToken;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw new Error(`Error processing scope creation: ${error.message}`);
      }
    }
  },
};

module.exports = scope;
