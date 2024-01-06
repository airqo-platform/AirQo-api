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
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- kya-answer-model`);

const knowYourAirAnswerSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "the title is required!"],
      unique: true,
    },
    content: {
      required: [true, "the content is required!"],
      type: [String],
      trim: true,
    },
    kya_question: {
      type: ObjectId,
      trim: true,
      ref: "kyaquestion",
    },
  },
  {
    timestamps: true,
  }
);

knowYourAirAnswerSchema.pre("save", function(next) {
  next();
});

knowYourAirAnswerSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

knowYourAirAnswerSchema.methods = {
  toJSON() {
    return {
      title: this.title,
      content: this.content,
      image: this.image,
      _id: this._id,
    };
  },
};

knowYourAirAnswerSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new answer....");
      let modifiedArgs = Object.assign({}, args);
      const createdKnowYourAirAnswer = await this.create({ ...modifiedArgs });
      if (!isEmpty(createdKnowYourAirAnswer)) {
        return {
          success: true,
          data: createdKnowYourAirAnswer._doc,
          message: "answer created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirAnswer)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "answer not created despite successful operation",
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
      const inclusionProjection = constants.KYA_ANSWERS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_ANSWERS_EXCLUSION_PROJECTION(
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
        .sort({ createdAt: -1 })
        .lookup({
          from: "kyaquestions",
          localField: "kya_question",
          foreignField: "_id",
          as: "kyaquestion",
        })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(
          limit
            ? limit
            : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_KYA_ANSWERS)
        )
        .allowDiskUse(true);

      const response = pipeline;

      if (!isEmpty(response)) {
        logObject("response", response);
        return {
          success: true,
          message: "successfully retrieved the answers",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No answers found for this operation",
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
      const updatedKnowYourAirAnswer = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedKnowYourAirAnswer", updatedKnowYourAirAnswer);
      if (!isEmpty(updatedKnowYourAirAnswer)) {
        return {
          success: true,
          message: "successfully modified the answer",
          data: updatedKnowYourAirAnswer._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirAnswer)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No answers found for this operation",
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
      const removedKnowYourAirAnswer = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedKnowYourAirAnswer)) {
        return {
          success: true,
          message: "successfully removed the answer",
          data: removedKnowYourAirAnswer._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedKnowYourAirAnswer)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No answers found for this operation",
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

const KnowYourAirAnswerModel = (tenant) => {
  try {
    let kyaanswers = mongoose.model("kyaanswers");
    return kyaanswers;
  } catch (error) {
    let kyaanswers = getModelByTenant(
      tenant,
      "kyaanswer",
      knowYourAirAnswerSchema
    );
    return kyaanswers;
  }
};

module.exports = KnowYourAirAnswerModel;
