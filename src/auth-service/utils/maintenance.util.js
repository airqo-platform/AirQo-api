const MaintenanceModel = require("@models/Maintenance");
const { generateFilter } = require("@utils/common");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- maintenances-util`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const maintenances = {
  list: async (request, next) => {
    try {
      const {
        query: { tenant },
      } = request;
      const filter = generateFilter.maintenances(request, next);
      const { limit, skip } = request.query;
      const listResponse = await MaintenanceModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return listResponse;
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
  create: async (request, next) => {
    try {
      const { body, query } = request;
      const { tenant, product } = query;
      const creationBody = {
        ...body,
        product,
      };
      const responseFromRegisterMaintenance = await MaintenanceModel(
        tenant
      ).register(creationBody, next);
      logObject(
        "responseFromRegisterMaintenance in UTILS",
        responseFromRegisterMaintenance
      );
      return responseFromRegisterMaintenance;
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
      const {
        query: { tenant },
        body,
      } = request;
      const filter = generateFilter.maintenances(request, next);
      if (isEmpty(filter)) {
        return {
          success: false,
          message: "Unable to identify which product to update",
          errors: {
            message: "Unable to identify which product to update",
          },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const modifyResponse = await MaintenanceModel(tenant).modify(
        {
          filter,
          update: body,
        },
        next
      );
      return modifyResponse;
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
      return {
        success: false,
        message: "Service Temporarily Unavailable",
        errors: {
          message: "Service Temporarily Unavailable",
        },
        status: httpStatus.SERVICE_UNAVAILABLE,
      };
      const {
        query: { tenant },
        body,
      } = request;

      const filter = generateFilter.maintenances(request, next);
      const responseFromRemoveMaintenance = await MaintenanceModel(
        tenant
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveMaintenance;
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

module.exports = maintenances;
