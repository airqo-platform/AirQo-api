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
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- kya-quiz-model`);

const knowYourAirQuizSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "the title is required!"],
      unique: true,
    },
    description: {
      type: String,
      required: [true, "the description is required!"],
    },
    image: {
      required: [true, "the image is required!"],
      type: String,
      trim: true,
    },
    completion_message: {
      required: [true, "the completion_message is required!"],
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);
knowYourAirQuizSchema.pre("save", function(next) {
  next();
});
knowYourAirQuizSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});
knowYourAirQuizSchema.methods = {
  toJSON() {
    return {
      title: this.title,
      completion_message: this.completion_message,
      image: this.image,
      _id: this._id,
      description: this.description,
    };
  },
};

knowYourAirQuizSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new quiz....");
      let modifiedArgs = Object.assign({}, args);
      const createdKnowYourAirQuiz = await this.create({ ...modifiedArgs });
      if (!isEmpty(createdKnowYourAirQuiz)) {
        return {
          success: true,
          data: createdKnowYourAirQuiz._doc,
          message: "quiz created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirQuiz)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "quiz not created despite successful operation",
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
  async list({ skip = 0, limit = 1000, filter = {}, user_id } = {}, next) {
    try {
      const inclusionProjection = constants.KYA_QUIZ_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_QUIZ_EXCLUSION_PROJECTION(
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
        .lookup({
          from: "kyaquestions",
          localField: "_id",
          foreignField: "kya_quiz",
          as: "questions",
        })
        .unwind("$questions")
        .sort({ "questions.question_position": 1 })
        .lookup({
          from: "kyaanswers",
          localField: "questions._id",
          foreignField: "kya_question",
          as: "answers",
        })
        .addFields({
          "questions.answers": "$answers",
        })
        .group({
          _id: "$_id",
          title: { $first: "$title" },
          description: { $first: "$description" },
          completion_message: { $first: "$completion_message" },
          image: { $first: "$image" },
          questions: { $push: "$questions" },
        })
        .lookup({
          from: "kyaquizprogresses",
          localField: "_id",
          foreignField: "quiz_id",
          let: {
            quizId: "$_id",
            userId: user_id,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$quiz_id", "$$quizId"] },
                    { $eq: ["$user_id", "$$userId"] },
                  ],
                },
              },
            },
          ],
          as: "kya_user_quiz_progress",
        })
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
          message: "successfully retrieved the quizzes",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No quizzes found for this operation",
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
      logObject("the filter in the model", filter);
      logObject("the update in the model", update);
      logObject("the opts in the model", opts);
      let modifiedUpdateBody = Object.assign({}, update);
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }

      let options = opts;

      logObject("the new modifiedUpdateBody", modifiedUpdateBody);

      const updatedKnowYourAirQuiz = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedKnowYourAirQuiz", updatedKnowYourAirQuiz);
      if (!isEmpty(updatedKnowYourAirQuiz)) {
        return {
          success: true,
          message: "successfully modified the quiz",
          data: updatedKnowYourAirQuiz._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirQuiz)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No quizzes found for this operation",
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
          description: 1,
        },
      };
      const removedKnowYourAirQuiz = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedKnowYourAirQuiz)) {
        return {
          success: true,
          message: "successfully removed the quiz",
          data: removedKnowYourAirQuiz._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedKnowYourAirQuiz)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No quizzes found for this operation",
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

const KnowYourAirQuizModel = (tenant) => {
  try {
    let kyaquizzes = mongoose.model("kyaquizzes");
    return kyaquizzes;
  } catch (error) {
    let kyaquizzes = getModelByTenant(tenant, "kyaquiz", knowYourAirQuizSchema);
    return kyaquizzes;
  }
};

module.exports = KnowYourAirQuizModel;
