const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;
const { logElement, logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");

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
  async register(args) {
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
        return {
          success: false,
          message: "Progress not created despite successful operation",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message: "Progress not created despite successful operation",
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
        constants.KYA_QUIZ_PROGRESS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_QUIZ_PROGRESS_EXCLUSION_PROJECTION(
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

const KnowYourAirUserQuizProgressModel = (tenant) => {
  try {
    let kyaprogress = mongoose.model("kyaquizprogresses");
    return kyaprogress;
  } catch (error) {
    let kyaprogress = getModelByTenant(
      tenant,
      "kyaquizprogress",
      userQuizProgressSchema
    );
    return kyaprogress;
  }
};

module.exports = KnowYourAirUserQuizProgressModel;
