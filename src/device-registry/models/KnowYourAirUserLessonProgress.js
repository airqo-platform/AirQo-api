const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;
const { logElement, logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");

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
    progress: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

userLessonProgressSchema.index({ lesson_id: 1, user_id: 1 }, { unique: true });

userLessonProgressSchema.pre("save", function (next) {
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
      progress: this.progress,
      _id: this._id,
    };
  },
};

userLessonProgressSchema.statics = {
  async register(args) {
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
          message: "lesson created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirLessonProgress)) {
        return {
          success: false,
          message: "lesson not created despite successful operation",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message: "lesson not created despite successful operation",
          },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(err.keyPattern) && err.code === 11000) {
        Object.entries(err.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response.message = value.message;
          response[key] = value.message;
          return response;
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}) {
    try {
      logObject("the filter in the model", filter);
      const inclusionProjection =
        constants.KYA_LESSONS_PROGRESS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_LESSONS_PROGRESS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );
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
    } catch (err) {
      logObject("the error", err);
      let response = { message: err.message };
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (err.code === 11000) {
        if (!isEmpty(err.keyPattern)) {
          Object.entries(err.keyPattern).forEach(([key, value]) => {
            response["message"] = "duplicate value";
            response[key] = "duplicate value";
            return response;
          });
        } else {
          response.message = "duplicate value";
        }
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async modify({ filter = {}, update = {}, opts = { new: true } } = {}) {
    try {
      logObject("the filter in the model", filter);
      logObject("the update in the model", update);
      logObject("the opts in the model", opts);
      let modifiedUpdateBody = Object.assign({}, update);
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }

      let options = opts;

      logObject("the new modifiedUpdateBody", modifiedUpdateBody);

      const updatedKnowYourAirLessonProgress = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject(
        "updatedKnowYourAirLessonProgress",
        updatedKnowYourAirLessonProgress
      );
      if (!isEmpty(updatedKnowYourAirLessonProgress)) {
        return {
          success: true,
          message: "successfully modified the lesson",
          data: updatedKnowYourAirLessonProgress._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirLessonProgress)) {
        return {
          success: false,
          message: "No progress found for this operation",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "No progress found for this operation" },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(err.code) && err.code === 11000) {
        Object.entries(err.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async remove({ filter = {} } = {}) {
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
        return {
          success: false,
          message: "No progress found for this operation",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "No progress found for this operation" },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (!isEmpty(err.code) && err.code === 11000) {
        Object.entries(err.keyPattern).forEach(([key, value]) => {
          response[key] = "duplicate value";
          response["message"] = "duplicate value";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
};

module.exports = userLessonProgressSchema;
