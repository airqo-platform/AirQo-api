const ApplicationEmailConfigurationModel = require("@models/ApplicationEmailConfiguration");
const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const mongoose = require("mongoose");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- application-email-config-util`
);

const applicationEmailConfig = {
  create: async (request, next) => {
    try {
      const { body } = request;
      const tenant = (
        body.tenant ||
        request.query.tenant ||
        constants.DEFAULT_TENANT ||
        "airqo"
      ).toLowerCase();

      const response = await ApplicationEmailConfigurationModel(tenant).register(
        { ...body, tenant },
        next
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  list: async (request, next) => {
    try {
      const { query, params } = request;
      const tenant = (
        query.tenant ||
        constants.DEFAULT_TENANT ||
        "airqo"
      ).toLowerCase();
      const { limit = 100, skip = 0 } = query;

      const filter = {};
      if (params.id) {
        filter._id = mongoose.Types.ObjectId(params.id);
      }

      const response = await ApplicationEmailConfigurationModel(tenant).list(
        { skip, limit, filter },
        next
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  update: async (request, next) => {
    try {
      const { query, body, params } = request;
      const tenant = (
        query.tenant ||
        constants.DEFAULT_TENANT ||
        "airqo"
      ).toLowerCase();

      const filter = { _id: mongoose.Types.ObjectId(params.id) };

      const hasReplacement = body.applicationEmails !== undefined;
      const hasAddRemove =
        !isEmpty(body.addApplicationEmails) ||
        !isEmpty(body.removeApplicationEmails);

      if (hasReplacement && hasAddRemove) {
        return {
          success: false,
          message:
            "Cannot combine applicationEmails replacement with addApplicationEmails or removeApplicationEmails in the same request",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "Use applicationEmails to replace the full list, or use addApplicationEmails/removeApplicationEmails for partial updates — not both at once",
          },
        };
      }

      const update = {};

      if (body.adminCCEmails !== undefined) {
        update.adminCCEmails = body.adminCCEmails;
      }

      if (hasReplacement) {
        update.applicationEmails = body.applicationEmails;
      } else {
        if (!isEmpty(body.addApplicationEmails)) {
          update.$addToSet = {
            applicationEmails: { $each: body.addApplicationEmails },
          };
        }
        if (!isEmpty(body.removeApplicationEmails)) {
          update.$pull = {
            applicationEmails: { $in: body.removeApplicationEmails },
          };
        }
      }

      if (isEmpty(update)) {
        return {
          success: false,
          message: "No update fields provided",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Provide at least one field to update" },
        };
      }

      const response = await ApplicationEmailConfigurationModel(tenant).modify(
        { filter, update },
        next
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  remove: async (request, next) => {
    try {
      const { query, params } = request;
      const tenant = (
        query.tenant ||
        constants.DEFAULT_TENANT ||
        "airqo"
      ).toLowerCase();

      const filter = { _id: mongoose.Types.ObjectId(params.id) };

      const response = await ApplicationEmailConfigurationModel(tenant).remove(
        { filter },
        next
      );
      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

module.exports = applicationEmailConfig;
