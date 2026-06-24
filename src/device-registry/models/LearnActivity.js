const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- learn-activity-model`
);

const ACTIVITY_TYPES = ["article", "video", "image", "quiz"];

const learnActivitySchema = new Schema(
  {
    lesson_id: {
      type: Schema.Types.ObjectId,
      ref: "learnlesson",
      required: [true, "lesson_id is required"],
    },
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: [true, "type is required"],
    },
    order: {
      type: Number,
      required: [true, "order is required"],
      min: 1,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: [true, "payload is required"],
    },
  },
  { timestamps: true }
);

learnActivitySchema.index({ lesson_id: 1, order: 1 }, { unique: true });

learnActivitySchema.statics = {
  async register(args, next) {
    try {
      const created = await this.create({ ...args });
      if (!isEmpty(created)) {
        return {
          success: true,
          data: created._doc,
          message: "activity created",
          status: httpStatus.CREATED,
        };
      }
      next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: "activity not created despite successful operation",
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

  async list({ filter = {}, skip = 0, limit = 5000 } = {}, next) {
    try {
      const activities = await this.find(filter)
        .sort({ order: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return {
        success: true,
        data: activities,
        message: "successfully retrieved activities",
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
          message: "successfully modified the activity",
          status: httpStatus.OK,
        };
      }
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "No activity found for this operation",
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
        projection: { _id: 1, type: 1, order: 1 },
      }).exec();
      if (!isEmpty(removed)) {
        return {
          success: true,
          data: removed._doc,
          message: "successfully removed the activity",
          status: httpStatus.OK,
        };
      }
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          message: "No activity found for this operation",
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

const LearnActivityModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("learnactivities");
  } catch (error) {
    return getModelByTenant(dbTenant, "learnactivity", learnActivitySchema);
  }
};

module.exports = LearnActivityModel;
