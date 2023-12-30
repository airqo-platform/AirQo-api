const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const { getModelByTenant } = require("@config/database");

const userLessonProgressSchema = new Schema(
  {
    user_id: {
      type: String,
      trim: true,
      required: [true, "firebase_user_id is required!"],
    },
    lesson_id: {
      type: ObjectId,
      ref: "kyalesson",
      required: true,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    active_task: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: "TODO",
    },
  },
  {
    timestamps: true,
  }
);

userLessonProgressSchema.index({ lesson_id: 1, user_id: 1 }, { unique: true });

userLessonProgressSchema.pre("save", function(next) {
  next();
});

userLessonProgressSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

userLessonProgressSchema.methods = {
  toJSON() {
    return {
      user_id: this.user_id,
      lesson_id: this.lesson_id,
      completed: this.completed,
      active_task: this.active_task,
      _id: this._id,
    };
  },
};

userLessonProgressSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new lesson....");
      let modifiedArgs = Object.assign({}, args);
      const createdKnowYourAirLessonProgress = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(createdKnowYourAirLessonProgress)) {
        return {
          success: true,
          data: createdKnowYourAirLessonProgress._doc,
          message: "Progress created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirLessonProgress)) {
        return {
          success: false,
          message: "Progress not created despite successful operation",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message: "Progress not created despite successful operation",
          },
        };
      }
    } catch (error) {
      logObject("the error", error);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.keyPattern) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response.message = value.message;
          response[key] = value.message;
          return response;
        });
      }
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      logObject("the filter in the model", filter);
      const inclusionProjection =
        constants.KYA_LESSONS_PROGRESS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_LESSONS_PROGRESS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );
      if (!isEmpty(filter.category)) {
        delete filter.category;
      }
      if (!isEmpty(filter.dashboard)) {
        delete filter.dashboard;
      }
      if (!isEmpty(filter.summary)) {
        delete filter.summary;
      }
      let pipeline = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(
          limit
            ? limit
            : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_KYA_LESSONS)
        )
        .allowDiskUse(true);

      const response = pipeline;

      if (!isEmpty(response)) {
        logObject("response", response);
        return {
          success: true,
          message: "successfully retrieved the progress",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No progress found for this operation",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logObject("the error", error);
      let response = { message: error.message };
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (error.code === 11000) {
        if (!isEmpty(error.keyPattern)) {
          Object.entries(error.keyPattern).forEach(([key, value]) => {
            response["message"] = "duplicate value";
            response[key] = "duplicate value";
            return response;
          });
        } else {
          response.message = "duplicate value";
        }
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      next(new HttpError(message, status, response));
    }
  },
  async modify({ filter = {}, update = {}, opts = { new: true } } = {}, next) {
    try {
      let modifiedUpdateBody = Object.assign({}, update);
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }

      let options = opts;

      const updatedKnowYourAirLessonProgress = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );

      if (!isEmpty(updatedKnowYourAirLessonProgress)) {
        return {
          success: true,
          message: "successfully modified the lesson",
          data: updatedKnowYourAirLessonProgress._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirLessonProgress)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No progress found for this operation",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.code) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      next(new HttpError(message, status, response));
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          title: 1,
          content: 1,
          image: 1,
        },
      };
      const removedKnowYourAirLessonProgress = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedKnowYourAirLessonProgress)) {
        return {
          success: true,
          message: "successfully removed the lesson",
          data: removedKnowYourAirLessonProgress._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedKnowYourAirLessonProgress)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No progress found for this operation",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(error.code) && error.code === 11000) {
        Object.entries(error.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(error.errors)) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      next(new HttpError(message, status, response));
    }
  },
};

const KnowYourAirUserLessonProgressModel = (tenant) => {
  try {
    let kyaprogress = mongoose.model("kyaprogresses");
    return kyaprogress;
  } catch (error) {
    let kyaprogress = getModelByTenant(
      tenant,
      "kyaprogress",
      userLessonProgressSchema
    );
    return kyaprogress;
  }
};

module.exports = KnowYourAirUserLessonProgressModel;
