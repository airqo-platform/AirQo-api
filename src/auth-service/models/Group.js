const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
const validator = require("validator");
var uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");

const GroupSchema = new Schema(
  {
    grp_title: {
      type: String,
      unique: true,
      required: [true, "grp_title is required"],
    },
    grp_status: { type: String, default: "INACTIVE" },
    grp_network_id: {
      type: ObjectId,
      ref: "network",
      trim: true,
      required: [true, "grp_network_id is required"],
    },
    grp_users: [
      {
        type: ObjectId,
        ref: "user",
      },
    ],
    grp_tasks: { type: Number },
    grp_description: {
      type: String,
      required: [true, "grp_description is required"],
    },
  },
  {
    timestamps: true,
  }
);

GroupSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

GroupSchema.index({ grp_title: 1 }, { unique: true });

GroupSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      grp_title: this.grp_title,
      grp_status: this.grp_status,
      grp_users: this.grp_users,
      grp_tasks: this.grp_tasks,
      grp_description: this.grp_description,
      grp_network_id: this.grp_network_id,
      createdAt: this.createdAt,
    };
  },
};

const sanitizeName = (name) => {
  try {
    let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
    let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
    let trimmedName = shortenedName.trim();
    return trimmedName.toLowerCase();
  } catch (error) {
    logElement("the sanitise name error", error.message);
  }
};

GroupSchema.statics = {
  async register(args) {
    try {
      let modifiedArgs = Object.assign({}, args);

      // if (modifiedArgs.grp_title) {
      //   modifiedArgs["grp_title"] = sanitizeName(grp_title);
      // }
      const data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "group created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data,
          message: "group NOT successfully created but operation successful",
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
      return {
        success: false,
        errors: response,
        message,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "grp_users",
          foreignField: "_id",
          as: "grp_users",
        })
        .lookup({
          from: "networks",
          localField: "grp_network_id",
          foreignField: "_id",
          as: "network",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          grp_title: 1,
          grp_status: 1,
          grp_tasks: 1,
          grp_description: 1,
          createdAt: 1,
          grp_users: "$grp_users",
          network: { $arrayElemAt: ["$network", 0] },
        })
        .project({
          "network.__v": 0,
          "network.createdAt": 0,
          "network.updatedAt": 0,
        })
        .project({
          "grp_users.__v": 0,
          "grp_users.notifications": 0,
          "grp_users.emailConfirmed": 0,
          "grp_users.groups": 0,
          "grp_users.locationCount": 0,
          "grp_users.group": 0,
          "grp_users.long_network": 0,
          "grp_users.privilege": 0,
          "grp_users.userName": 0,
          "grp_users.password": 0,
          "grp_users.duration": 0,
          "grp_users.createdAt": 0,
          "grp_users.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the groups",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "groups do not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
          errors: { message: "unable to retrieve groups" },
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
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      if (modifiedUpdate.grp_title) {
        delete modifiedUpdate.grp_title;
      }

      if (modifiedUpdate.grp_users) {
        modifiedUpdate["$addToSet"]["grp_users"] = {};
        modifiedUpdate["$addToSet"]["grp_users"]["$each"] =
          modifiedUpdate.grp_users;
        delete modifiedUpdate["grp_users"];
      }

      const updatedOrganization = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedOrganization)) {
        return {
          success: true,
          message: "successfully modified the group",
          data: updatedOrganization._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedOrganization)) {
        return {
          success: true,
          message: "group does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Not Found" },
          data: [],
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
      let options = {
        projection: {
          _id: 1,
          grp_title: 1,
          grp_status: 1,
          grp_description: 1,
          createdAt: 1,
        },
      };
      const removedOrganization = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedOrganization)) {
        return {
          success: true,
          message: "successfully removed the group",
          data: removedOrganization._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedOrganization)) {
        return {
          success: true,
          message: "group does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Not Found" },
          data: [],
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
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
};

module.exports = GroupSchema;
