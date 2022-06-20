const { Schema, model } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { logObject, logElement, logText } = require("../utils/log");
const HTTPStatus = require("http-status");
const isEmpty = require("is-empty");

const activitySchema = new Schema(
  {
    device: { type: String, trim: true },
    site_id: { type: ObjectId },
    date: { type: Date },
    description: { type: String, trim: true },
    activityType: { type: String, trim: true },
    tags: [{ type: String }],
    nextMaintenance: { type: Date },
    maintenanceType: { type: String },
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
      date: this.date,
      description: this.description,
      activityType: this.activityType,
      maintenanceType: this.maintenanceType,
      nextMaintenance: this.nextMaintenance,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tags: this.tags,
      site_id: this.site_id,
    };
  },
};

activitySchema.statics = {
  async register(args) {
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
          status: HTTPStatus.CREATED,
        };
      } else if (isEmpty(createdActivity)) {
        return {
          success: false,
          message: "Activity not created despite successful operation",
          status: HTTPStatus.ACCEPTED,
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      Object.entries(err.errors).forEach(([key, value]) => {
        return (response[key] = value.message);
      });
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      let response = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          device: 1,
          date: 1,
          description: 1,
          activityType: 1,
          maintenanceType: 1,
          nextMaintenance: 1,
          createdAt: 1,
          updatedAt: 1,
          tags: 1,
          site_id: 1,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        let data = response;
        return {
          success: true,
          message: "successfully retrieved the activities",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "no activities exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: filter,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
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
      logObject("modifiedUpdateBody", modifiedUpdateBody);
      let updatedActivity = await this.findOneAndUpdate(
        filter,
        modifiedUpdateBody,
        options
      );
      logObject("updatedActivity", updatedActivity);
      if (!isEmpty(updatedActivity)) {
        let data = updatedActivity._doc;
        return {
          success: true,
          message: "successfully modified the activity",
          data,
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(updatedActivity)) {
        return {
          success: false,
          message: "activity does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: filter,
        };
      }
    } catch (err) {
      return {
        errors: { message: err.message },
        message: "Internal Server Error",
        success: false,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          device: 1,
          site_id: 1,
          date: 1,
          description: 1,
          activityType: 1,
        },
      };
      let removedActivity = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedActivity)) {
        let data = removedActivity._doc;
        return {
          success: true,
          message: "successfully removed the activity",
          data,
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(removedActivity)) {
        return {
          success: false,
          message: "activity does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: filter,
        };
      }
    } catch (err) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = activitySchema;
