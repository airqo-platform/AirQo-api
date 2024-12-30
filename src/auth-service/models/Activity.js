const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
var uniqueValidator = require("mongoose-unique-validator");
const { logObject } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- activity-model`);

const activitySchema = new Schema(
  {
    email: { type: String, required: true },
    username: { type: String },
    tenant: { type: String, required: true },
    // Daily stats
    dailyStats: [
      {
        date: { type: Date, required: true },
        totalActions: { type: Number, default: 0 },
        services: [
          {
            name: String,
            count: Number,
          },
        ],
        endpoints: [
          {
            name: String,
            count: Number,
          },
        ],
      },
    ],
    monthlyStats: [
      {
        year: { type: Number, required: true },
        month: { type: Number, required: true },
        totalActions: { type: Number, default: 0 },
        uniqueServices: [String],
        uniqueEndpoints: [String],
        topServices: [
          {
            name: String,
            count: Number,
          },
        ],
        engagementScore: Number,
        engagementTier: String,
        firstActivity: Date,
        lastActivity: Date,
      },
    ],
    overallStats: {
      totalActions: { type: Number, default: 0 },
      firstActivity: Date,
      lastActivity: Date,
      engagementScore: Number,
      engagementTier: String,
    },
    lastProcessedLog: { type: mongoose.Schema.Types.ObjectId, ref: "logs" },
  },
  {
    timestamps: true,
    indexes: [
      { email: 1, tenant: 1 },
      { tenant: 1, "monthlyStats.year": 1, "monthlyStats.month": 1 },
      { "dailyStats.date": 1 },
      { lastProcessedLog: 1 },
    ],
  }
);

activitySchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

activitySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
    };
  },
};

activitySchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "activity created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data,
          message: "activity NOT successfully created but operation successful",
          status: httpStatus.ACCEPTED,
        };
      }
    } catch (err) {
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
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      logObject("filter", filter);
      const inclusionProjection = constants.ACTIVITIES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.ACTIVITIES_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the activitys",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "activitys do not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
          errors: { message: "unable to retrieve activitys" },
        };
      }
    } catch (err) {
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

      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      let options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      const updatedActivity = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedActivity)) {
        return {
          success: true,
          message: "successfully modified the activity",
          data: updatedActivity._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedActivity)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "activity does not exist, please crosscheck -- Not Found",
          })
        );
      }
    } catch (err) {
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
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: {
          _id: 1,
        },
      };
      const removedActivity = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedActivity)) {
        return {
          success: true,
          message: "successfully removed the activity",
          data: removedActivity._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedActivity)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Bad Request, activity Not Found -- please crosscheck",
          })
        );
      }
    } catch (err) {
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
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
};

const ActivityModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("activities");
  } catch (error) {
    return getModelByTenant(dbTenant, "activity", activitySchema);
  }
};

module.exports = ActivityModel;
