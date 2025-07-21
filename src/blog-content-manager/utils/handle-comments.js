const mongoose = require("mongoose");
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- handle-comments-util`
);
const { HttpError } = require("@utils/errors");
const CommentModel = require("@models/Comment");
const PostModel = require("@models/Post");

const commentUtil = {
  async create(postId, requestBody, next) {
    try {
      const errors = extractErrorsFromRequest(requestBody);
      if (errors) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          errors,
        };
      }

      const post = await PostModel().findById(postId);
      if (!post) {
        throw new HttpError("Post not found", httpStatus.NOT_FOUND);
      }

      const comment = new CommentModel({
        ...requestBody,
        post: postId,
        author: requestBody.author,
      });

      const result = await comment.save();

      if (result) {
        return {
          success: true,
          status: httpStatus.CREATED,
          data: result.toJSON(),
        };
      } else {
        throw new HttpError(
          "Failed to create comment",
          httpStatus.INTERNAL_SERVER_ERROR
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async list(postId, request, next) {
    try {
      const errors = extractErrorsFromRequest(request);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const comments = await CommentModel().getCommentsByPost(
        postId,
        request.query,
        next
      );

      if (!comments.success) {
        throw new HttpError(comments.message, comments.status);
      }

      return comments;
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

  async replies(postId, commentId, request, next) {
    try {
      const errors = extractErrorsFromRequest(request);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const comments = await CommentModel().list(
        { post: postId, parentComment: commentId },
        request.query,
        next
      );

      if (!comments.success) {
        throw new HttpError(comments.message, comments.status);
      }

      return comments;
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

  async edit(postId, commentId, requestBody, next) {
    try {
      const errors = extractErrorsFromRequest(requestBody);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const comment = await CommentModel().findById(commentId);
      if (!comment) {
        throw new HttpError("Comment not found", httpStatus.NOT_FOUND);
      }

      const updatedComment = await comment.updateOne({
        $set: requestBody,
      });

      if (updatedComment.nModified > 0) {
        return {
          success: true,
          status: httpStatus.OK,
          data: updatedComment.toJSON(),
        };
      } else {
        throw new HttpError(
          "Failed to update comment",
          httpStatus.INTERNAL_SERVER_ERROR
        );
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

  async delete(postId, commentId, requestBody, next) {
    try {
      const errors = extractErrorsFromRequest(requestBody);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const comment = await CommentModel().findByIdAndRemove(commentId);
      if (!comment) {
        throw new HttpError("Comment not found", httpStatus.NOT_FOUND);
      }

      // Remove all child comments
      await CommentModel().deleteMany({ parentComment: commentId });

      return {
        success: true,
        status: httpStatus.NO_CONTENT,
      };
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

  async approve(postId, commentId, requestBody, next) {
    try {
      const errors = extractErrorsFromRequest(requestBody);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const comment = await CommentModel().findByIdAndUpdate(
        commentId,
        { status: "approved" },
        { new: true }
      );

      if (!comment) {
        throw new HttpError("Comment not found", httpStatus.NOT_FOUND);
      }

      return {
        success: true,
        status: httpStatus.OK,
        data: comment.toJSON(),
      };
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

  async reject(postId, commentId, requestBody, next) {
    try {
      const errors = extractErrorsFromRequest(requestBody);
      if (errors) {
        next(
          new HttpError("Bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const comment = await CommentModel().findByIdAndUpdate(
        commentId,
        { status: "rejected" },
        { new: true }
      );

      if (!comment) {
        throw new HttpError("Comment not found", httpStatus.NOT_FOUND);
      }

      return {
        success: true,
        status: httpStatus.OK,
        data: comment.toJSON(),
      };
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

function extractErrorsFromRequest(req) {
  // Implement error extraction logic here
  // This function should parse the request object and return any validation errors
  // Return null if no errors found
}

module.exports = commentUtil;
