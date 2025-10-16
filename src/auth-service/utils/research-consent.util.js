const ResearchConsentModel = require("@models/ResearchConsent");
const { HttpError, createSuccessResponse } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- research-consent-util`
);

const researchConsent = {
  create: async (request, next) => {
    try {
      const { body, query, user } = request;
      const { tenant } = query;
      if (!user || !user._id) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Missing authenticated user",
          })
        );
      }
      const payload = { ...body, userId: user._id };

      return await ResearchConsentModel(tenant).register(payload);
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
      const { query, params, user } = request;
      const { tenant } = query;
      const requestedUserId = params.userId;
      const currentUserId = user && (user._id || user.id);
      if (!currentUserId) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Missing authenticated user",
          })
        );
      }
      // Only allow self-access; expand with role checks as needed
      if (requestedUserId && requestedUserId !== String(currentUserId)) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Cannot access other users' consent",
          })
        );
      }

      const filter = { userId: currentUserId };

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
      const { query, body, params, user } = request;
      const { tenant } = query;
      const requestedUserId = params.userId;
      const currentUserId = user && (user._id || user.id);
      if (!currentUserId) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Missing authenticated user",
          })
        );
      }
      if (requestedUserId && requestedUserId !== String(currentUserId)) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Cannot modify other users' consent",
          })
        );
      }

      const filter = { userId: currentUserId };
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
      const { query, body, params, user } = request;
      const { tenant } = query;
      const requestedUserId = params.userId;
      const currentUserId = user && (user._id || user.id);
      if (!currentUserId) {
        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message: "Missing authenticated user",
          })
        );
      }
      if (requestedUserId && requestedUserId !== String(currentUserId)) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Cannot withdraw other users' consent",
          })
        );
      }

      const filter = { userId: currentUserId };
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
