const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- learn-lesson-model`
);

const learnLessonSchema = new Schema(
  {
    unit_id: {
      type: Schema.Types.ObjectId,
      ref: "learnunit",
      required: [true, "unit_id is required"],
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
    lesson_order: {
      type: Number,
      required: [true, "lesson_order is required"],
      min: 1,
    },
    cover_image_url: {
      type: String,
      trim: true,
      validate: {
        validator: (v) => !v || /^https:\/\/.+/.test(v),
        message: "cover_image_url must be a valid HTTPS URL",
      },
    },
    completion_message: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

learnLessonSchema.index({ unit_id: 1, lesson_order: 1 }, { unique: true });

learnLessonSchema.statics = {
  async register(args, next) {
    try {
      const created = await this.create({ ...args });
      if (!isEmpty(created)) {
        return {
          success: true,
          data: created._doc,
          message: "lesson created",
          status: httpStatus.CREATED,
        };
      }
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: "lesson not created despite successful operation",
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

  async list({ filter = {}, skip = 0, limit = 1000 } = {}, next) {
    try {
      const lessons = await this.find(filter)
        .sort({ lesson_order: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return {
        success: true,
        data: lessons,
        message: "successfully retrieved lessons",
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
          message: "successfully modified the lesson",
          status: httpStatus.OK,
        };
      }
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "No lesson found for this operation",
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

  async remove({ filter = {} } = {}, next) {
    try {
      const removed = await this.findOneAndRemove(filter, {
        projection: { _id: 1, title: 1 },
      }).exec();
      if (!isEmpty(removed)) {
        return {
          success: true,
          data: removed._doc,
          message: "successfully removed the lesson",
          status: httpStatus.OK,
        };
      }
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "No lesson found for this operation",
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

const LearnLessonModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("learnlessons");
  } catch (error) {
    return getModelByTenant(dbTenant, "learnlesson", learnLessonSchema);
  }
};

module.exports = LearnLessonModel;
