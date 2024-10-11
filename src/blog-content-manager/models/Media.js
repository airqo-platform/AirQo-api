const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- media-model`);
const { HttpError } = require("@utils/errors");

const MediaSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Media title is required"],
      trim: true,
      maxlength: [200, "Media title cannot be more than 200 characters"],
    },
    type: {
      type: String,
      required: [true, "Media type is required"],
      enum: ["image", "video", "audio", "document"],
    },
    url: {
      type: String,
      required: [true, "Media URL is required"],
      trim: true,
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
    },
    mimeType: {
      type: String,
      required: [true, "MIME type is required"],
    },
    alt: {
      type: String,
      trim: true,
      maxlength: [200, "Alt text cannot be more than 200 characters"],
    },
    caption: {
      type: String,
      trim: true,
      maxlength: [500, "Caption cannot be more than 500 characters"],
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Author",
      required: [true, "Author is required"],
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
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

MediaSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

MediaSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      title: this.title,
      type: this.type,
      url: this.url,
      fileSize: this.fileSize,
      mimeType: this.mimeType,
      alt: this.alt,
      caption: this.caption,
      author: this.author,
      post: this.post,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

MediaSchema.statics = {
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
          message: "Media created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create media",
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
      const media = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(media)) {
        return {
          success: true,
          data: media,
          total,
          message: "Successfully retrieved media",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No media found",
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
      const media = await this.findOne({ _id: id }).exec();

      if (!isEmpty(media)) {
        return {
          success: true,
          data: media,
          message: "Successfully retrieved media",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Media not found", httpStatus.NOT_FOUND));
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
      const updatedMedia = await this.findByIdAndUpdate(
        id,
        update,
        options
      ).exec();

      if (!isEmpty(updatedMedia)) {
        return {
          success: true,
          message: "Successfully updated the media",
          data: updatedMedia,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Media not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedMedia = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedMedia)) {
        return {
          success: true,
          message: "Successfully removed the media",
          data: removedMedia,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Media not found", httpStatus.NOT_FOUND));
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

  async findByPost(postId, next) {
    try {
      const media = await this.find({ post: postId }).exec();

      return {
        success: true,
        data: media,
        message: "Successfully retrieved media for the post",
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

  async getMediaStats(next) {
    try {
      const stats = await this.aggregate([
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalSize: { $sum: "$fileSize" },
          },
        },
      ]).exec();

      return {
        success: true,
        data: stats,
        message: "Successfully retrieved media stats",
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

const MediaModel = (tenant) => {
  try {
    let media = mongoose.model("media");
    return media;
  } catch (error) {
    let media = getModelByTenant(tenant, "media", MediaSchema);
    return media;
  }
};

module.exports = MediaModel;
