const mongoose = require("mongoose").set("debug", true);
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- checklist-model`);
const { HttpError } = require("@utils/errors");

const checklistItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: "no title",
  },
  completed: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    default: "not started",
    enum: ["not started", "in progress", "completed", "started"],
  },
  completionDate: {
    type: Date,
  },
  videoProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
});

const ChecklistSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "user_id is required"],
      unique: true,
    },
    items: [checklistItemSchema],
  },
  {
    timestamps: true,
  }
);

ChecklistSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

ChecklistSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      user_id: this.user_id,
      items: this.items,
    };
  },
};

ChecklistSchema.statics = {
  async register(args, next) {
    try {
      let body = args;
      if (body._id) {
        delete body._id;
      }
      let data = await this.create({
        ...body,
      });

      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "checklist created successfully with no issues detected",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          message: "checklist not created despite successful operation",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (err) {
      logger.error(`Internal Server Error ${err.message}`);
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const checklists = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();

      if (!isEmpty(checklists)) {
        return {
          success: true,
          data: checklists,
          message: "successfully listed the checklists",
          status: httpStatus.OK,
        };
      } else if (isEmpty(checklists)) {
        return {
          success: true,
          message: "no checklists found for this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      if (update._id) {
        delete update._id;
      }
      const updatedChecklist = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedChecklist)) {
        return {
          success: true,
          message: "successfully modified the checklist",
          data: updatedChecklist._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedChecklist)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "the User Checklist you are trying to UPDATE does not exist, please crosscheck",
          })
        );
      }
    } catch (err) {
      logger.error(`Data conflicts detected -- ${err.message}`);
      let errors = { message: err.message };
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code == 11000) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
      }
      next(new HttpError(message, status, errors));
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: {
          _id: 1,
          user_id: 1,
        },
      };
      const removedChecklist = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedChecklist)) {
        return {
          success: true,
          message: "successfully removed the checklist",
          data: removedChecklist._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedChecklist)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "the User Checklist  you are trying to DELETE does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

const ChecklistModel = (tenant) => {
  try {
    let checklists = mongoose.model("checklists");
    return checklists;
  } catch (error) {
    let checklists = getModelByTenant(tenant, "checklist", ChecklistSchema);
    return checklists;
  }
};

module.exports = ChecklistModel;
