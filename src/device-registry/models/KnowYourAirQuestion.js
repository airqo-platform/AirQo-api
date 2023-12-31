const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const { getModelByTenant } = require("@config/database");
const knowYourAirQuestionSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "the title is required!"],
      unique: true,
    },
    context: {
      required: [true, "the context is required!"],
      type: String,
      trim: true,
    },
    kya_quiz: {
      type: ObjectId,
      trim: true,
      ref: "kyaquiz",
    },
    question_position: {
      type: Number,
      required: [true, "the question number is required!"],
    },
  },
  {
    timestamps: true,
  }
);

knowYourAirQuestionSchema.pre("save", function(next) {
  next();
});

knowYourAirQuestionSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

knowYourAirQuestionSchema.methods = {
  toJSON() {
    return {
      title: this.title,
      context: this.context,
      image: this.image,
      _id: this._id,
      question_position: this.question_position,
    };
  },
};

knowYourAirQuestionSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new question....");
      let modifiedArgs = Object.assign({}, args);
      const createdKnowYourAirQuestion = await this.create({ ...modifiedArgs });
      if (!isEmpty(createdKnowYourAirQuestion)) {
        return {
          success: true,
          data: createdKnowYourAirQuestion._doc,
          message: "question created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirQuestion)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "question not created despite successful operation",
            }
          )
        );
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
      const inclusionProjection = constants.KYA_QUESTIONS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_QUESTIONS_EXCLUSION_PROJECTION(
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
      const pipeline = await this.aggregate()
        .match(filter)
        .sort({ question_position: 1 })
        .lookup({
          from: "kyaanswers",
          localField: "_id",
          foreignField: "kya_question",
          as: "answers",
        })
        .lookup({
          from: "kyaquizzes",
          localField: "kya_quiz",
          foreignField: "_id",
          as: "kyaquiz",
        })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(
          limit
            ? limit
            : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_KYA_QUESTIONS)
        )
        .allowDiskUse(true);

      const response = pipeline;

      if (!isEmpty(response)) {
        logObject("response", response);
        return {
          success: true,
          message: "successfully retrieved the questions",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No questions found for this operation",
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
      logObject("the filter in the model", filter);
      logObject("the update in the model", update);
      logObject("the opts in the model", opts);
      let modifiedUpdateBody = Object.assign({}, update);
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }

      let options = opts;

      logObject("the new modifiedUpdateBody", modifiedUpdateBody);

      const updatedKnowYourAirQuestion = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedKnowYourAirQuestion", updatedKnowYourAirQuestion);
      if (!isEmpty(updatedKnowYourAirQuestion)) {
        return {
          success: true,
          message: "successfully modified the question",
          data: updatedKnowYourAirQuestion._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirQuestion)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No questions found for this operation",
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
          context: 1,
          image: 1,
          question_position: 1,
        },
      };
      const removedKnowYourAirQuestion = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedKnowYourAirQuestion)) {
        return {
          success: true,
          message: "successfully removed the question",
          data: removedKnowYourAirQuestion._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedKnowYourAirQuestion)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No questions found for this operation",
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

const KnowYourAirQuestionModel = (tenant) => {
  try {
    let kyaquestions = mongoose.model("kyaquestions");
    return kyaquestions;
  } catch (error) {
    let kyaquestions = getModelByTenant(
      tenant,
      "kyaquestion",
      knowYourAirQuestionSchema
    );
    return kyaquestions;
  }
};

module.exports = KnowYourAirQuestionModel;
