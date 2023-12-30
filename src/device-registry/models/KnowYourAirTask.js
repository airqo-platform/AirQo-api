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
const knowYourAirTaskSchema = new Schema(
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
    content: {
      required: [true, "the content is required!"],
      type: String,
      trim: true,
    },
    kya_lesson: {
      type: ObjectId,
      trim: true,
      ref: "kyalesson",
    },
    task_position: {
      type: Number,
      required: [true, "the task number is required!"],
    },
  },
  {
    timestamps: true,
  }
);

knowYourAirTaskSchema.pre("save", function(next) {
  next();
});

knowYourAirTaskSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

knowYourAirTaskSchema.methods = {
  toJSON() {
    return {
      title: this.title,
      content: this.content,
      image: this.image,
      _id: this._id,
      task_position: this.task_position,
    };
  },
};

knowYourAirTaskSchema.statics = {
  async register(args, next) {
    try {
      logText("registering a new task....");
      let modifiedArgs = Object.assign({}, args);
      const createdKnowYourAirTask = await this.create({ ...modifiedArgs });
      if (!isEmpty(createdKnowYourAirTask)) {
        return {
          success: true,
          data: createdKnowYourAirTask._doc,
          message: "task created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdKnowYourAirTask)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "task not created despite successful operation",
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
      const inclusionProjection = constants.KYA_TASKS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.KYA_TASKS_EXCLUSION_PROJECTION(
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
        .sort({ task_position: 1 })
        .lookup({
          from: "kyalessons",
          localField: "kya_lesson",
          foreignField: "_id",
          as: "kyalessons",
        })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(
          limit
            ? limit
            : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_KYA_TASKS)
        )
        .allowDiskUse(true);

      const response = pipeline;

      if (!isEmpty(response)) {
        logObject("response", response);
        return {
          success: true,
          message: "successfully retrieved the tasks",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "No tasks found for this operation",
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

      const updatedKnowYourAirTask = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedKnowYourAirTask", updatedKnowYourAirTask);
      if (!isEmpty(updatedKnowYourAirTask)) {
        return {
          success: true,
          message: "successfully modified the task",
          data: updatedKnowYourAirTask._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedKnowYourAirTask)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No task found for this operation",
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
          task_position: 1,
        },
      };
      const removedKnowYourAirTask = await this.findOneAndRemove(
        filter,
        options
      ).exec();
      if (!isEmpty(removedKnowYourAirTask)) {
        return {
          success: true,
          message: "successfully removed the task",
          data: removedKnowYourAirTask._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedKnowYourAirTask)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No tasks found for this operation",
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

const KnowYourAirTaskModel = (tenant) => {
  try {
    let kyatasks = mongoose.model("kyatasks");
    return kyatasks;
  } catch (error) {
    let kyatasks = getModelByTenant(tenant, "kyatask", knowYourAirTaskSchema);
    return kyatasks;
  }
};

module.exports = KnowYourAirTaskModel;
