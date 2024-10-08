const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- author-model`);
const { HttpError } = require("@utils/errors");

const AuthorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Author name is required"],
      trim: true,
      maxlength: [100, "Author name cannot be more than 100 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot be more than 500 characters"],
    },
    avatar: {
      type: String,
      default: "default-avatar.png",
    },
    socialMedia: {
      twitter: String,
      facebook: String,
      linkedin: String,
      instagram: String,
    },
    website: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["author", "editor", "admin"],
      default: "author",
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

AuthorSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

AuthorSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      email: this.email,
      bio: this.bio,
      avatar: this.avatar,
      socialMedia: this.socialMedia,
      website: this.website,
      role: this.role,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

AuthorSchema.statics = {
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
          message: "Author created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create author",
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
      const authors = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(authors)) {
        return {
          success: true,
          data: authors,
          total,
          message: "Successfully retrieved authors",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No authors found",
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
      const author = await this.findOne({ _id: id }).exec();

      if (!isEmpty(author)) {
        return {
          success: true,
          data: author,
          message: "Successfully retrieved author",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Author not found", httpStatus.NOT_FOUND));
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
      const updatedAuthor = await this.findByIdAndUpdate(
        id,
        update,
        options
      ).exec();

      if (!isEmpty(updatedAuthor)) {
        return {
          success: true,
          message: "Successfully updated the author",
          data: updatedAuthor,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Author not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedAuthor = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedAuthor)) {
        return {
          success: true,
          message: "Successfully removed the author",
          data: removedAuthor,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Author not found", httpStatus.NOT_FOUND));
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

  async findByEmail(email, next) {
    try {
      const author = await this.findOne({ email }).exec();

      if (!isEmpty(author)) {
        return {
          success: true,
          data: author,
          message: "Successfully retrieved author",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Author not found", httpStatus.NOT_FOUND));
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

  async getAuthorStats(id, next) {
    try {
      const PostModel = mongoose.model("Post");
      const CommentModel = mongoose.model("Comment");

      const [postCount, commentCount] = await Promise.all([
        PostModel.countDocuments({ author: id }),
        CommentModel.countDocuments({ author: id }),
      ]);

      return {
        success: true,
        data: { postCount, commentCount },
        message: "Successfully retrieved author stats",
        status: httpStatus.OK,
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

const AuthorModel = (tenant) => {
  try {
    let authors = mongoose.model("authors");
    return authors;
  } catch (error) {
    let authors = getModelByTenant(tenant, "author", AuthorSchema);
    return authors;
  }
};

module.exports = AuthorModel;
