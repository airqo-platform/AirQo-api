const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const ObjectId = Schema.Types.ObjectId;
const { logElement, logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const HTTPStatus = require("http-status");

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
  async register(args) {
    try {
      logText("registering a new lesson....");
      let modifiedArgs = Object.assign({}, args);
      const createdKnowYourAirLesson = await this.create({ ...modifiedArgs });
      if (!isEmpty(createdKnowYourAirLesson)) {
        return {
          success: true,
          data: createdKnowYourAirLesson._doc,
          message: "lesson created",
          status: HTTPStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirLesson)) {
        return {
          success: false,
          message: "lesson not created despite successful operation",
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
          errors: {
            message: "lesson not created despite successful operation",
          },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
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
      const inclusionProjection = constants.KYA_LESSONS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_LESSONS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );
      let pipeline = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .lookup({
          from: "kyatasks",
          localField: "_id",
          foreignField: "kya_lesson",
          as: "tasks",
        })
        .project(inclusionProjection)
        .skip(skip ? skip : 0)
        .limit(
          limit
            ? limit
            : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_KYA_LESSONS)
        )
        .allowDiskUse(true);

      if (Object.keys(exclusionProjection).length > 0) {
        // Construct the $project stage dynamically with the exclusionProjection
        const projectionStage = { $project: {} };
        Object.entries(exclusionProjection).forEach(([key, value]) => {
          projectionStage.$project[key] = value;
        });

        // Add the projection stage to the pipeline
        pipeline.push(projectionStage);
      }

      const response = pipeline;

      if (!isEmpty(response)) {
        logObject("response", response);
        return {
          success: true,
          message: "successfully retrieved the lessons",
          data: response,
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No lessons found for this operation",
          status: HTTPStatus.OK,
          data: [],
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = { message: err.message };
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
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
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirLesson)) {
        return {
          success: false,
          message: "No lessons found for this operation",
          status: HTTPStatus.BAD_REQUEST,
          errors: { message: "No lessons found for this operation" },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
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
      const removedKnowYourAirLesson = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedKnowYourAirLesson)) {
        return {
          success: true,
          message: "successfully removed the lesson",
          data: removedKnowYourAirLesson._doc,
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(removedKnowYourAirLesson)) {
        return {
          success: false,
          message: "No lessons found for this operation",
          status: HTTPStatus.BAD_REQUEST,
          errors: { message: "No lessons found for this operation" },
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
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

module.exports = knowYourAirLessonSchema;
