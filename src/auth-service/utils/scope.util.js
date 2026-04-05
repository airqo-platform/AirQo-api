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
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw error;
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
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw error;
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
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw error;
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
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw error;
      }
    }
  },

  bulkCreateScopes: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { scopes } = body;

      if (!Array.isArray(scopes) || scopes.length === 0) {
        return {
          success: false,
          message: "scopes must be a non-empty array",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "scopes array is required" },
        };
      }

      const response = await ScopeModel(tenant.toLowerCase()).bulkInsert(
        scopes,
        next
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw error;
      }
    }
  },

  initializeDefaultScopes: async (request, next) => {
    try {
      const { query } = request;
      const tenant = (query.tenant || constants.DEFAULT_TENANT || "airqo").toLowerCase();

      const defaultScopes = [
        {
          scope: "read:recent_measurements",
          description: "Access to recent measurements (last 24 hours)",
          tier: "Free",
          resource_type: "measurements",
          access_type: "read",
          data_timeframe: "recent",
        },
        {
          scope: "read:devices",
          description: "Access to device metadata",
          tier: "Free",
          resource_type: "devices",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:sites",
          description: "Access to site metadata",
          tier: "Free",
          resource_type: "sites",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:cohorts",
          description: "Access to cohort metadata",
          tier: "Free",
          resource_type: "cohorts",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:grids",
          description: "Access to grid metadata",
          tier: "Free",
          resource_type: "grids",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:historical_measurements",
          description: "Access to historical measurements",
          tier: "Standard",
          resource_type: "measurements",
          access_type: "read",
          data_timeframe: "historical",
        },
        {
          scope: "read:forecasts",
          description: "Access to air quality forecasts",
          tier: "Premium",
          resource_type: "forecasts",
          access_type: "read",
          data_timeframe: "all",
        },
        {
          scope: "read:insights",
          description: "Access to air quality insights and analytics",
          tier: "Premium",
          resource_type: "insights",
          access_type: "read",
          data_timeframe: "all",
        },
      ];

      const response = await ScopeModel(tenant).bulkInsert(
        defaultScopes,
        next
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (typeof next === "function") {
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      } else {
        throw error;
      }
    }
  },
};

module.exports = scope;
