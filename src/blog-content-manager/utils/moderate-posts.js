const mongoose = require("mongoose");
const AuthorModel = require("@models/Author");
const CommentModel = require("@models/Comment");
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- moderate-content`);

const { HttpError } = require("@utils/errors");

const moderateContent = {
  reviewAuthor: async (request, next) => {
    try {
      const { tenant } = request.query;
      const authorId = request.params.authorId;

      // Check if the author exists
      const authorExists = await AuthorModel(tenant).findById(authorId);
      if (!authorExists) {
        throw new HttpError("Author not found", httpStatus.NOT_FOUND);
      }

      // Assuming we have a function to review and manage user registrations
      const result = await AuthorModel(tenant).reviewRegistration(next);

      logObject("result", result);

      return {
        success: true,
        message: "Successfully reviewed author",
        data: result,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  flagComment: async (request, next) => {
    try {
      const { tenant } = request.query;
      const commentId = request.params.commentId;

      // Check if the comment exists
      const commentExists = await CommentModel(tenant).findById(commentId);
      if (!commentExists) {
        throw new HttpError("Comment not found", httpStatus.NOT_FOUND);
      }

      // Assuming we have a function to flag inappropriate content
      const result = await contentModerationUtil.flagComment(
        commentId,
        request.body,
        next
      );

      logObject("result", result);

      return {
        success: true,
        message: "Successfully flagged comment",
        data: result,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  viewFlags: async (request, next) => {
    try {
      const { tenant } = request.query;
      const commentId = request.params.commentId;

      // Fetch flags for the comment
      const flags = await CommentModel(tenant).find({
        _id: mongoose.Types.ObjectId(commentId),
        flags: { $exists: true, $type: "array" },
      });

      logObject("flags", flags);

      return {
        success: true,
        message: "Successfully retrieved flags",
        data: flags,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  manageAuthors: async (request, next) => {
    try {
      const { tenant } = request.query;
      const authorId = request.params.authorId;
      const requestBody = Object.assign({}, request.body);

      // Assuming we have a function to manage author accounts
      const result = await AuthorModel(tenant)[request.method.toLowerCase()](
        authorId,
        requestBody,
        next
      );

      logObject("result", result);

      return {
        success: true,
        message: "Successfully managed author",
        data: result,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },
};

module.exports = moderateContent;
