const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- comment-model`);
const { HttpError } = require("@utils/errors");

const CommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Post reference is required"],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author is required"],
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true,
      maxlength: [1000, "Comment cannot be more than 1000 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    likes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

CommentSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

CommentSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      post: this.post,
      author: this.author,
      content: this.content,
      status: this.status,
      parentComment: this.parentComment,
      likes: this.likes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

CommentSchema.statics = {
  async create(args, next) {
    try {
      let body = args;
      if (body._id) {
        delete body._id;
      }
      let data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Comment created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create comment",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          data: null,
        };
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async list({ skip = 0, limit = 20, filter = {} } = {}, next) {
    try {
      const comments = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name")
        .populate("post", "title")
        .populate("parentComment", "_id")
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(comments)) {
        return {
          success: true,
          data: comments,
          total,
          message: "Successfully retrieved comments",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No comments found",
          data: [],
          total: 0,
          status: httpStatus.OK,
        };
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

  async findById(id, next) {
    try {
      const comment = await this.findOne({ _id: id })
        .populate("author", "name")
        .populate("post", "title")
        .populate("parentComment", "_id")
        .exec();

      if (!isEmpty(comment)) {
        return {
          success: true,
          data: comment,
          message: "Successfully retrieved comment",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Comment not found", httpStatus.NOT_FOUND));
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

  async update({ id, update = {} } = {}, next) {
    try {
      const options = { new: true, runValidators: true };
      if (update._id) {
        delete update._id;
      }
      const updatedComment = await this.findByIdAndUpdate(id, update, options)
        .populate("author", "name")
        .populate("post", "title")
        .populate("parentComment", "_id")
        .exec();

      if (!isEmpty(updatedComment)) {
        return {
          success: true,
          message: "Successfully updated the comment",
          data: updatedComment,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Comment not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedComment = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedComment)) {
        // Remove all child comments
        await this.deleteMany({ parentComment: id });

        return {
          success: true,
          message: "Successfully removed the comment and its replies",
          data: removedComment,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Comment not found", httpStatus.NOT_FOUND));
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

  async incrementLikes(id, next) {
    try {
      const updatedComment = await this.findByIdAndUpdate(
        id,
        { $inc: { likes: 1 } },
        { new: true }
      ).exec();

      if (!isEmpty(updatedComment)) {
        return {
          success: true,
          message: "Successfully incremented comment likes",
          data: updatedComment,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Comment not found", httpStatus.NOT_FOUND));
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

  async getCommentsByPost(postId, { skip = 0, limit = 20 } = {}, next) {
    try {
      const comments = await this.find({ post: postId, parentComment: null })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name")
        .populate({
          path: "post",
          select: "title",
          match: { _id: postId },
        })
        .exec();

      const total = await this.countDocuments({
        post: postId,
        parentComment: null,
      });

      if (!isEmpty(comments)) {
        return {
          success: true,
          data: comments,
          total,
          message: "Successfully retrieved comments for the post",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No comments found for this post",
          data: [],
          total: 0,
          status: httpStatus.OK,
        };
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
};

const CommentModel = (tenant) => {
  try {
    let comments = mongoose.model("comments");
    return comments;
  } catch (error) {
    let comments = getModelByTenant(tenant, "comment", CommentSchema);
    return comments;
  }
};

module.exports = CommentModel;
