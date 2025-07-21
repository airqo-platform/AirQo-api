/**
Post.js: Represents blog posts
Comment.js: Handles comments on posts
Category.js: For organizing posts into categories
Tag.js: Represents tags for posts
Author.js: If you want to separate author profiles from general user accounts
Media.js: For handling images, videos, or other media attached to posts
Setting.js: For storing application-wide settings
Subscription.js: If you have a newsletter or subscription feature
Analytics.js: For storing analytics data if you're tracking it internally
 */
const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- post-model`);
const { HttpError } = require("@utils/errors");

const PostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot be more than 200 characters"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Author",
      required: [true, "Author is required"],
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    publishDate: {
      type: Date,
    },
    featuredImage: {
      type: String,
    },
    slug: {
      type: String,
      unique: true,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

PostSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

PostSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      title: this.title,
      content: this.content,
      author: this.author,
      categories: this.categories,
      tags: this.tags,
      status: this.status,
      publishDate: this.publishDate,
      featuredImage: this.featuredImage,
      slug: this.slug,
      views: this.views,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

PostSchema.statics = {
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
          message: "Post created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create post",
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
      const posts = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("author", "name")
        .populate("categories", "name")
        .populate("tags", "name")
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(posts)) {
        return {
          success: true,
          data: posts,
          total,
          message: "Successfully retrieved posts",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No posts found",
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
      const post = await this.findOne({ _id: id })
        .populate("author", "name")
        .populate("categories", "name")
        .populate("tags", "name")
        .exec();

      if (!isEmpty(post)) {
        return {
          success: true,
          data: post,
          message: "Successfully retrieved post",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
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
      const updatedPost = await this.findByIdAndUpdate(id, update, options)
        .populate("author", "name")
        .populate("categories", "name")
        .populate("tags", "name")
        .exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Successfully updated the post",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedPost = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedPost)) {
        return {
          success: true,
          message: "Successfully removed the post",
          data: removedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
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

  async incrementViews(id, next) {
    try {
      const updatedPost = await this.findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { new: true }
      ).exec();

      if (!isEmpty(updatedPost)) {
        return {
          success: true,
          message: "Successfully incremented post views",
          data: updatedPost,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Post not found", httpStatus.NOT_FOUND));
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

const PostModel = (tenant) => {
  try {
    let posts = mongoose.model("posts");
    return posts;
  } catch (error) {
    let posts = getModelByTenant(tenant, "post", PostSchema);
    return posts;
  }
};

module.exports = PostModel;
