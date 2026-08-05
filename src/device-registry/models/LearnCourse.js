const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- learn-course-model`
);

const learnCourseSchema = new Schema(
  {
    course_number: {
      type: Number,
      required: [true, "course_number is required"],
      unique: true,
      min: 1,
    },
    title: {
      type: String,
      required: [true, "title is required"],
      maxlength: [120, "title must not exceed 120 characters"],
      trim: true,
    },
    plain_title_key: {
      type: String,
      required: [true, "plain_title_key is required"],
      trim: true,
    },
    cover_image_url: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^https:\/\/.+/.test(v),
        message: "cover_image_url must be a valid HTTPS URL",
      },
    },
    published: {
      type: Boolean,
      default: false,
    },
    catalog_version: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

learnCourseSchema.plugin(uniqueValidator, { message: `{VALUE} already taken!` });

learnCourseSchema.statics = {
  async register(args, next) {
    try {
      const created = await this.create({ ...args });
      if (!isEmpty(created)) {
        return {
          success: true,
          data: created._doc,
          message: "course created",
          status: httpStatus.CREATED,
        };
      }
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: "course not created despite successful operation",
        })
      );
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.keyPattern) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key]) => {
          response[key] = "duplicate value";
          response.message = "duplicate value";
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response.message = value.message;
        });
      }
      next(new HttpError(message, status, response));
    }
  },

  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const courses = await this.find(filter)
        .sort({ course_number: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return {
        success: true,
        data: courses,
        message: "successfully retrieved courses",
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },

  async modify({ filter = {}, update = {}, opts = { new: true } } = {}, next) {
    try {
      const modifiedUpdate = { ...update };
      delete modifiedUpdate._id;
      const updated = await this.findOneAndUpdate(filter, modifiedUpdate, opts);
      if (!isEmpty(updated)) {
        return {
          success: true,
          data: updated._doc,
          message: "successfully modified the course",
          status: httpStatus.OK,
        };
      }
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "No course found for this operation",
        })
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.keyPattern) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key]) => {
          response[key] = "duplicate value";
          response.message = "duplicate value";
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response.message = value.message;
        });
      }
      next(new HttpError(message, status, response));
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const removed = await this.findOneAndRemove(filter, {
        projection: { _id: 1, title: 1 },
      }).exec();
      if (!isEmpty(removed)) {
        return {
          success: true,
          data: removed._doc,
          message: "successfully removed the course",
          status: httpStatus.OK,
        };
      }
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "No course found for this operation",
        })
      );
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  },
};

const LearnCourseModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  return getModelByTenant(dbTenant, "learncourse", learnCourseSchema);
};

module.exports = LearnCourseModel;
