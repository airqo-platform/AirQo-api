const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logObject } = require("@utils/log");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const validator = require("validator");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- site-activities-model`
);

const activitySchema = new Schema(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    userName: { type: String, trim: true },
    email: {
      type: String,
      unique: true,
      trim: true,
      validate: {
        validator(email) {
          return validator.isEmail(email);
        },
        message: "{VALUE} is not a valid email!",
      },
    },
    device: { type: String, trim: true },
    site_id: { type: ObjectId },
    host_id: { type: ObjectId },
    date: { type: Date },
    description: { type: String, trim: true },
    network: {
      type: String,
      trim: true,
    },
    group: {
      type: String,
      trim: true,
    },
    activityType: { type: String, trim: true },
    activity_codes: [
      {
        type: String,
        trim: true,
      },
    ],
    tags: [{ type: String }],
    nextMaintenance: { type: Date },
    maintenanceType: { type: String },
    recallType: { type: String },
    createdAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      device: this.device,
      network: this.network,
      group: this.group,
      date: this.date,
      description: this.description,
      activityType: this.activityType,
      activity_codes: this.activity_codes,
      maintenanceType: this.maintenanceType,
      recallType: this.recallType,
      nextMaintenance: this.nextMaintenance,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tags: this.tags,
      site_id: this.site_id,
      host_id: this.host_id,
      firstName: this.firstName,
      lastName: this.lastName,
      userName: this.userName,
      email: this.email,
    };
  },
};

activitySchema.statics = {
  async register(args, next) {
    try {
      let modifiedArgs = args;
      let createdActivity = await this.create({
        ...modifiedArgs,
      });

      if (!isEmpty(createdActivity)) {
        let data = createdActivity._doc;
        delete data.__v;
        delete data.updatedAt;
        return {
          success: true,
          data,
          message: "Activity created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdActivity)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "Activity not created despite successful operation" }
          )
        );
      }
    } catch (error) {
      logObject("the error", error);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      Object.entries(error.errors).forEach(([key, value]) => {
        response.message = value.message;
        response[key] = value.message;
        return response;
      });

      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection =
        constants.SITE_ACTIVITIES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.SITE_ACTIVITIES_EXCLUSION_PROJECTION(
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
          message: "successfully retrieved the activities",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no activities exist, please crosscheck",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logObject("the error", error);
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`Internal Server Error -- ${stingifiedMessage}`);

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
      let options = { new: true, useFindAndModify: false, upsert: false };
      let modifiedUpdateBody = update;
      modifiedUpdateBody["$addToSet"] = {};
      if (modifiedUpdateBody._id) {
        delete modifiedUpdateBody._id;
      }

      if (modifiedUpdateBody.tags) {
        modifiedUpdateBody["$addToSet"]["tags"] = {};
        modifiedUpdateBody["$addToSet"]["tags"]["$each"] =
          modifiedUpdateBody.tags;
        delete modifiedUpdateBody["tags"];
      }
      const updatedActivity = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
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
            ...filter,
            message: "activity does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`Internal Server Error -- ${stingifiedMessage}`);

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: {
          _id: 1,
          device: 1,
          site_id: 1,
          host_id: 1,
          network: 1,
          date: 1,
          description: 1,
          activityType: 1,
          activity_codes: 1,
        },
      };
      let removedActivity = await this.findOneAndRemove(filter, options).exec();

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
            ...filter,
            message: "activity does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`Internal Server Error -- ${stingifiedMessage}`);

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

const ActivityModel = (tenant) => {
  try {
    const activities = mongoose.model("activities");
    return activities;
  } catch (errors) {
    return getModelByTenant(tenant.toLowerCase(), "activity", activitySchema);
  }
};

module.exports = ActivityModel;
