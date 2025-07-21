const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- reply-model`);
const { HttpError } = require("@utils/errors");

const ReplySchema = new mongoose.Schema(
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
      required: [true, "Reply content is required"],
      trim: true,
      maxlength: [500, "Reply cannot be more than 500 characters"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: [true, "Parent comment is required"],
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

ReplySchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

ReplySchema.methods = {
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

ReplySchema.statics = {
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
          message: "Reply created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create reply",
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
      const replies = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name")
        .populate("post", "title")
        .populate("parentComment", "_id")
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(replies)) {
        return {
          success: true,
          data: replies,
          total,
          message: "Successfully retrieved replies",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No replies found",
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
      const reply = await this.findOne({ _id: id })
        .populate("author", "name")
        .populate("post", "title")
        .populate("parentComment", "_id")
        .exec();

      if (!isEmpty(reply)) {
        return {
          success: true,
          data: reply,
          message: "Successfully retrieved reply",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Reply not found", httpStatus.NOT_FOUND));
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
      const updatedReply = await this.findByIdAndUpdate(id, update, options)
        .populate("author", "name")
        .populate("post", "title")
        .populate("parentComment", "_id")
        .exec();

      if (!isEmpty(updatedReply)) {
        return {
          success: true,
          message: "Successfully updated the reply",
          data: updatedReply,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Reply not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedReply = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedReply)) {
        // Remove all child replies
        await this.deleteMany({ parentComment: id });

        return {
          success: true,
          message: "Successfully removed the reply and its children",
          data: removedReply,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Reply not found", httpStatus.NOT_FOUND));
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
      const updatedReply = await this.findByIdAndUpdate(
        id,
        { $inc: { likes: 1 } },
        { new: true }
      ).exec();

      if (!isEmpty(updatedReply)) {
        return {
          success: true,
          message: "Successfully incremented reply likes",
          data: updatedReply,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Reply not found", httpStatus.NOT_FOUND));
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

  async getRepliesByComment(commentId, { skip = 0, limit = 20 } = {}, next) {
    try {
      const replies = await this.find({ parentComment: commentId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name")
        .populate({
          path: "post",
          select: "title",
          match: { _id: "$post" },
        })
        .exec();

      const total = await this.countDocuments({ parentComment: commentId });

      if (!isEmpty(replies)) {
        return {
          success: true,
          data: replies,
          total,
          message: "Successfully retrieved replies for the comment",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No replies found for this comment",
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

const ReplyModel = (tenant) => {
  try {
    let replies = mongoose.model("replies");
    return replies;
  } catch (error) {
    let replies = getModelByTenant(tenant, "reply", ReplySchema);
    return replies;
  }
};

module.exports = ReplyModel;
