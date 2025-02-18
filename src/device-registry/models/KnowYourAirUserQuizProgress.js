const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- kya-quiz-progress-model`
);

const userQuizProgressSchema = new Schema(
  {
    user_id: {
      type: String,
      trim: true,
      required: [true, "firebase_user_id is required!"],
    },
    quiz_id: {
      type: ObjectId,
      ref: "kyaquiz",
      required: true,
    },
    active_question: {
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

userQuizProgressSchema.index({ quiz_id: 1, user_id: 1 }, { unique: true });

userQuizProgressSchema.pre("save", function(next) {
  next();
});

userQuizProgressSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

userQuizProgressSchema.methods = {
  toJSON() {
    return {
      user_id: this.user_id,
      quiz_id: this.quiz_id,
      completed: this.completed,
      active_question: this.active_question,
      _id: this._id,
    };
  },
};

userQuizProgressSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new quiz....");
      let modifiedArgs = Object.assign({}, args);
      const createdKnowYourAirQuizProgress = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(createdKnowYourAirQuizProgress)) {
        return {
          success: true,
          data: createdKnowYourAirQuizProgress._doc,
          message: "Progress created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirQuizProgress)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "Progress not created despite successful operation",
            }
          )
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
        constants.KYA_QUIZ_PROGRESS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_QUIZ_PROGRESS_EXCLUSION_PROJECTION(
        filter.path ? filter.path : "none"
      );

      if (!isEmpty(filter.path)) {
        delete filter.path;
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
            : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_KYA_QUIZZES)
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
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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

      logObject("the new modifiedUpdateBody", modifiedUpdateBody);

      const updatedKnowYourAirQuizProgress = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject(
        "updatedKnowYourAirQuizProgress",
        updatedKnowYourAirQuizProgress
      );
      if (!isEmpty(updatedKnowYourAirQuizProgress)) {
        return {
          success: true,
          message: "successfully modified the quiz",
          data: updatedKnowYourAirQuizProgress._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirQuizProgress)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No progress found for this operation",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
      const removedKnowYourAirQuizProgress = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedKnowYourAirQuizProgress)) {
        return {
          success: true,
          message: "successfully removed the quiz",
          data: removedKnowYourAirQuizProgress._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedKnowYourAirQuizProgress)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No progress found for this operation",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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

const KnowYourAirUserQuizProgressModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let kyaprogress = mongoose.model("kyaquizprogresses");
    return kyaprogress;
  } catch (error) {
    let kyaprogress = getModelByTenant(
      dbTenant,
      "kyaquizprogress",
      userQuizProgressSchema
    );
    return kyaprogress;
  }
};

module.exports = KnowYourAirUserQuizProgressModel;
