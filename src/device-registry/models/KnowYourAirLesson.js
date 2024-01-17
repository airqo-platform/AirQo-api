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
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- kya-lesson-model`);

const knowYourAirLessonSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "the title is required!"],
      unique: true,
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

knowYourAirLessonSchema.pre("save", function(next) {
  next();
});

knowYourAirLessonSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

knowYourAirLessonSchema.methods = {
  toJSON() {
    return {
      title: this.title,
      completion_message: this.completion_message,
      image: this.image,
      _id: this._id,
    };
  },
};

knowYourAirLessonSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new lesson....");
      let modifiedArgs = Object.assign({}, args);
      const createdKnowYourAirLesson = await this.create({ ...modifiedArgs });
      if (!isEmpty(createdKnowYourAirLesson)) {
        return {
          success: true,
          data: createdKnowYourAirLesson._doc,
          message: "lesson created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirLesson)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "lesson not created despite successful operation",
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
      const inclusionProjection = constants.KYA_LESSONS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_LESSONS_EXCLUSION_PROJECTION(
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
          from: "kyatasks",
          localField: "_id",
          foreignField: "kya_lesson",
          as: "tasks",
        })
        .unwind("$tasks")
        .sort({ "tasks.task_position": 1 })
        .group({
          _id: "$_id",
          title: { $first: "$title" },
          completion_message: { $first: "$completion_message" },
          image: { $first: "$image" },
          tasks: { $push: "$tasks" },
        })
        .lookup({
          from: "kyaprogresses",
          localField: "_id",
          foreignField: "lesson_id",
          let: {
            lessonId: "$_id",
            userId: user_id,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$lesson_id", "$$lessonId"] },
                    { $eq: ["$user_id", "$$userId"] },
                  ],
                },
              },
            },
          ],
          as: "kya_user_progress",
        })
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
          message: "successfully retrieved the lessons",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No lessons found for this operation",
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

      const updatedKnowYourAirLesson = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedKnowYourAirLesson", updatedKnowYourAirLesson);
      if (!isEmpty(updatedKnowYourAirLesson)) {
        return {
          success: true,
          message: "successfully modified the lesson",
          data: updatedKnowYourAirLesson._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirLesson)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No lessons found for this operation",
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
      const removedKnowYourAirLesson = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedKnowYourAirLesson)) {
        return {
          success: true,
          message: "successfully removed the lesson",
          data: removedKnowYourAirLesson._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedKnowYourAirLesson)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No lessons found for this operation",
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

const KnowYourAirLessonModel = (tenant) => {
  try {
    let kyalessons = mongoose.model("kyalessons");
    return kyalessons;
  } catch (error) {
    let kyalessons = getModelByTenant(
      tenant,
      "kyalesson",
      knowYourAirLessonSchema
    );
    return kyalessons;
  }
};

module.exports = KnowYourAirLessonModel;
