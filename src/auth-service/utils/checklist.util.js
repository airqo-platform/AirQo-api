const ChecklistModel = require("@models/Checklist");
const UserModel = require("@models/User");
const {
  winstonLogger,
  mailer,
  stringify,
  date,
  msgs,
  emailTemplates,
  generateFilter,
  handleResponse,
} = require("@utils/common");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- checklists-util`);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const checklists = {
  list: async (request, next) => {
    try {
      const {
        query: { tenant },
      } = request;
      const filter = generateFilter.checklists(request, next);
      const { limit, skip } = request.query;
      const responseFromListChecklist = await ChecklistModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListChecklist;
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
      const { tenant } = query;
      const user_id = body.user_id;
      const user = await UserModel(tenant).findById(user_id).lean();
      if (isEmpty(user_id) || isEmpty(user)) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "The provided User does not exist",
            value: user_id,
          })
        );
      }

      const responseFromRegisterDefault = await ChecklistModel(tenant).register(
        body,
        next
      );
      return responseFromRegisterDefault;
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

      const filter = generateFilter.checklists(request, next);
      const update = body;
      const modifyResponse = await ChecklistModel(tenant).modify(
        {
          filter,
          update,
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
  upsert: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.checklists(request, next);

      // Check if a checklist for the user already exists
      const existingChecklist = await ChecklistModel(tenant)
        .findOne(filter)
        .lean();

      if (isEmpty(existingChecklist)) {
        // If it doesn't exist, create it.
        logText("Checklist does not exist, creating a new one...");
        return checklists.create(request, next);
      } else {
        // If it exists, update it.
        logText("Checklist exists, updating...");
        // The update validator expects user_id in params, so we adjust the request object.
        request.params.user_id = body.user_id;
        return checklists.update(request, next);
      }
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
      const filter = generateFilter.checklists(request, next);
      const { tenant } = request.query;
      const responseFromRemoveDefault = await ChecklistModel(tenant).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveDefault;
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

module.exports = checklists;
