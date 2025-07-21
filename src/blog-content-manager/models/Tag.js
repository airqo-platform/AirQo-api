const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- tag-model`);
const { HttpError } = require("@utils/errors");

const TagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tag name is required"],
      trim: true,
      unique: true,
      maxlength: [50, "Tag name cannot be more than 50 characters"],
    },
    slug: {
      type: String,
      required: [true, "Tag slug is required"],
      trim: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Tag description cannot be more than 200 characters"],
    },
    color: {
      type: String,
      default: "#000000",
      match: [/^#([0-9A-F]{3}){1,2}$/i, "Invalid color format"],
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

TagSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

TagSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
      slug: this.slug,
      description: this.description,
      color: this.color,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

TagSchema.statics = {
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
          message: "Tag created successfully",
          status: httpStatus.CREATED,
        };
      } else {
        return {
          success: false,
          message: "Failed to create tag",
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
      const tags = await this.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .exec();

      const total = await this.countDocuments(filter);

      if (!isEmpty(tags)) {
        return {
          success: true,
          data: tags,
          total,
          message: "Successfully retrieved tags",
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No tags found",
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
      const tag = await this.findOne({ _id: id }).exec();

      if (!isEmpty(tag)) {
        return {
          success: true,
          data: tag,
          message: "Successfully retrieved tag",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Tag not found", httpStatus.NOT_FOUND));
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
      const updatedTag = await this.findByIdAndUpdate(
        id,
        update,
        options
      ).exec();

      if (!isEmpty(updatedTag)) {
        return {
          success: true,
          message: "Successfully updated the tag",
          data: updatedTag,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Tag not found", httpStatus.NOT_FOUND));
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      next(new HttpError(err.message, httpStatus.INTERNAL_SERVER_ERROR));
    }
  },

  async remove(id, next) {
    try {
      const removedTag = await this.findByIdAndRemove(id).exec();

      if (!isEmpty(removedTag)) {
        return {
          success: true,
          message: "Successfully removed the tag",
          data: removedTag,
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Tag not found", httpStatus.NOT_FOUND));
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

  async findBySlug(slug, next) {
    try {
      const tag = await this.findOne({ slug }).exec();

      if (!isEmpty(tag)) {
        return {
          success: true,
          data: tag,
          message: "Successfully retrieved tag",
          status: httpStatus.OK,
        };
      } else {
        next(new HttpError("Tag not found", httpStatus.NOT_FOUND));
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

  async getTagStats(next) {
    try {
      const PostModel = mongoose.model("Post");
      const stats = await PostModel.aggregate([
        { $unwind: "$tags" },
        { $group: { _id: "$tags", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).exec();

      return {
        success: true,
        data: stats,
        message: "Successfully retrieved tag stats",
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

const TagModel = (tenant) => {
  try {
    let tags = mongoose.model("tags");
    return tags;
  } catch (error) {
    let tags = getModelByTenant(tenant, "tag", TagSchema);
    return tags;
  }
};

module.exports = TagModel;
