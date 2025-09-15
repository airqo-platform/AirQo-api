const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const httpStatus = require("http-status");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
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
    device_id: { type: ObjectId },
    host_id: { type: ObjectId },
    user_id: { type: ObjectId },
    grid_id: {
      type: ObjectId,
      ref: "grid",
    },
    deployment_type: {
      type: String,
      enum: ["static", "mobile"],
      default: "static",
      trim: true,
      lowercase: true,
    },

    date: { type: Date },
    description: { type: String, trim: true },
    network: {
      type: String,
      trim: true,
    },
    groups: {
      type: [String],
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
    mobility_metadata: {
      route_id: { type: String, trim: true },
      coverage_area: { type: String, trim: true },
      operational_hours: { type: String, trim: true },
      movement_pattern: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.pre("save", function(next) {
  // Only validate deployment-specific requirements for deployment activities
  if (this.activityType === "deployment") {
    // Validation: For static deployments, site_id should be provided
    if (this.deployment_type === "static" && !this.site_id) {
      return next(new Error("site_id is required for static deployments"));
    }

    // Validation: For mobile deployments, grid_id should be provided
    if (this.deployment_type === "mobile" && !this.grid_id) {
      return next(new Error("grid_id is required for mobile deployments"));
    }

    // Validation: Prevent conflicting location references
    if (this.deployment_type === "static" && this.grid_id) {
      return next(
        new Error("grid_id should not be provided for static deployments")
      );
    }

    if (this.deployment_type === "mobile" && this.site_id) {
      return next(
        new Error("site_id should not be provided for mobile deployments")
      );
    }
  }

  // For non-deployment activities (recall, maintenance, etc.), skip deployment validation
  next();
});

activitySchema.index({ site_id: 1, createdAt: -1 });
activitySchema.index({ device_id: 1, createdAt: -1 });
activitySchema.index({ device: 1, createdAt: -1 });

activitySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      device: this.device,
      network: this.network,
      groups: this.groups,
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
      user_id: this.user_id,
      // ENHANCED: Include new fields
      grid_id: this.grid_id,
      deployment_type: this.deployment_type,
      mobility_metadata: this.mobility_metadata,
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

      if (modifiedArgs.activityType === "deployment") {
        if (!modifiedArgs.deployment_type) {
          if (modifiedArgs.grid_id) {
            modifiedArgs.deployment_type = "mobile";
          } else if (modifiedArgs.site_id) {
            modifiedArgs.deployment_type = "static";
          } else {
            modifiedArgs.deployment_type = "static"; // default for deployments
          }
        }
      }

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

      if (error.errors) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response.message = value.message;
          response[key] = value.message;
          return response;
        });
      } else {
        response.message = error.message;
      }

      next(new HttpError(message, status, response));
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection =
        constants.SITE_ACTIVITIES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.SITE_ACTIVITIES_EXCLUSION_PROJECTION(
        filter.path ? filter.path : "none"
      );
      if (!isEmpty(filter.path)) {
        delete filter.path;
      }
      if (!isEmpty(filter.dashboard)) {
        delete filter.dashboard;
      }
      if (!isEmpty(filter.summary)) {
        delete filter.summary;
      }

      // ENHANCED: Add lookup for grid information in mobile deployments
      const pipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "grids",
            localField: "grid_id",
            foreignField: "_id",
            as: "grid",
          },
        },
        {
          $lookup: {
            from: "sites",
            localField: "site_id",
            foreignField: "_id",
            as: "site",
          },
        },
        { $sort: { createdAt: -1 } },
        { $project: inclusionProjection },
        { $project: exclusionProjection },
        { $skip: skip ? skip : 0 },
        { $limit: limit ? limit : 100 },
      ];

      const response = await this.aggregate(pipeline).allowDiskUse(true);

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
      logger.error(
        `🐛🐛 Internal Server Error -- ${
          error ? error.message : "No error message"
        }`
      );
      logger.error(`Error stack: ${error ? error.stack : "No stack trace"}`);
      logger.error(
        `Error in list method with filter: ${JSON.stringify(filter)}`
      );

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
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);

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
          user_id: 1,
          grid_id: 1, // ENHANCED: Include grid_id
          deployment_type: 1, // ENHANCED: Include deployment_type
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
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);

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
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const activities = mongoose.model("activities");
    return activities;
  } catch (errors) {
    return getModelByTenant(dbTenant.toLowerCase(), "activity", activitySchema);
  }
};

module.exports = ActivityModel;
