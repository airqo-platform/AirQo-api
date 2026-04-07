const ResearchConsentModel = require("@models/ResearchConsent");
const { HttpError, createSuccessResponse } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- research-consent-util`,
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
          }),
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
          { message: error.message },
        ),
      );
    }
  },
  list: async (request, next) => {
    try {
      const { query, params, user } = request;
      const { tenant } = query;
      const requestedUserId = params.userId;
      const currentUserId = user && (user._id || user.id);

      // If authenticated, enforce self-access validation (users can only see their own consent)
      if (currentUserId) {
        if (requestedUserId && requestedUserId !== String(currentUserId)) {
          return next(
            new HttpError("Forbidden", httpStatus.FORBIDDEN, {
              message: "Cannot access other users' consent",
            }),
          );
        }

        const filter = { userId: currentUserId };
        return await ResearchConsentModel(tenant).findConsent({ filter });
      }

      // If unauthenticated, allow public read access to consent records by userId param
      // This enables checking if a user has consented without requiring authentication
      if (requestedUserId) {
        const filter = { userId: requestedUserId };
        const result = await ResearchConsentModel(tenant).findConsent({
          filter,
        });

        // For unauthenticated requests, we might want to return limited data
        // or just a boolean indicating if consent exists. Adjust based on your privacy requirements.
        if (result.success === true && result.data) {
          // Option A: Return full consent data (if consent records are not sensitive)
          // return result;

          // Option B: Return only existence status (more privacy-conscious)
          return {
            success: true,
            data: {
              hasConsent: true,
              consentVersion: result.data.consentVersion,
              studyStatus: result.data.studyStatus,
            },
            status: httpStatus.OK,
          };

          // Option C: Return a generic message without revealing consent details
          // return {
          //   success: true,
          //   data: {
          //     hasConsent: true,
          //   },
          //   status: httpStatus.OK,
          // };
        }

        return result; // No consent found
      }

      // No userId param and no authenticated user
      return next(
        new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
          message: "userId parameter is required",
        }),
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
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
          }),
        );
      }
      if (requestedUserId && requestedUserId !== String(currentUserId)) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Cannot modify other users' consent",
          }),
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
          { message: error.message },
        ),
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
          }),
        );
      }
      if (requestedUserId && requestedUserId !== String(currentUserId)) {
        return next(
          new HttpError("Forbidden", httpStatus.FORBIDDEN, {
            message: "Cannot withdraw other users' consent",
          }),
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
          { message: error.message },
        ),
      );
    }
  },
};

module.exports = researchConsent;
