const ResearchConsentModel = require("@models/ResearchConsent");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- research-consent-util`
);

const researchConsent = {
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant } = query;

      return await ResearchConsentModel(tenant).register(body);
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
      const { tenant } = query;
      const { userId } = params;

      const filter = { userId };

      return await ResearchConsentModel(tenant).findConsent({ filter });
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
      const { query, body, params } = request;
      const { tenant } = query;
      const { userId } = params;

      const filter = { userId };
      const update = { consentTypes: body.consentTypes };

      return await ResearchConsentModel(tenant).updateConsent({
        filter,
        update,
      });
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
      const { query, body, params } = request;
      const { tenant } = query;
      const { userId } = params;

      const filter = { userId };
      const withdrawalInfo = body;

      return await ResearchConsentModel(tenant).withdraw({
        filter,
        withdrawalInfo,
      });
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

module.exports = researchConsent;
