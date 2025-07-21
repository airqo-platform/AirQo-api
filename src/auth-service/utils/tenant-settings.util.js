const TenantSettingsModel = require("@models/TenantSettings");
const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const { stringify, generateFilter } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- tenant-settings-util`
);

const tenantSettings = {
  create: async (request, next) => {
    try {
      const { body } = request;
      const { tenant } = { ...body };

      const responseFromCreate = await TenantSettingsModel(tenant).register(
        body,
        next
      );

      return responseFromCreate;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  list: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, limit, skip } = { ...query, ...params };

      const filter = generateFilter.tenantSettings(request, next);

      const response = await TenantSettingsModel(tenant.toLowerCase()).list(
        { skip, limit, filter },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  update: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const filter = generateFilter.tenantSettings(request, next);

      let update = Object.assign({}, body);

      const response = await TenantSettingsModel(tenant.toLowerCase()).modify(
        { filter, update },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  delete: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.tenantSettings(request, next);
      const response = await TenantSettingsModel(tenant.toLowerCase()).remove(
        { filter },
        next
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = tenantSettings;
