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

      // The filter should target the specific user's checklist
      const filter = { user_id: request.params.user_id };

      // Construct the update to modify a specific item in the 'items' array
      // This now assumes the client sends the item's title to identify it.
      const itemToUpdate = body.items && body.items[0];
      if (!itemToUpdate || !itemToUpdate.title) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Checklist item with a 'title' is required for update",
          })
        );
      }

      // Use the title to find the correct item in the array
      const update = { $set: { "items.$[elem]": itemToUpdate } };
      const options = {
        arrayFilters: [{ "elem.title": itemToUpdate.title }],
        new: true,
      };

      const modifyResponse = await ChecklistModel(tenant).modify(
        {
          filter,
          update,
          options,
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

      // The filter will be based on user_id to ensure one checklist per user
      const filter = generateFilter.checklists(request, next);
      const update = body;

      // Options for the modify method: upsert will create if it doesn't exist.
      const options = { upsert: true, new: true };

      const modifyResponse = await ChecklistModel(tenant).modify(
        {
          filter,
          update,
          options,
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
