const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
var uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");

const DepartmentSchema = new Schema(
  {
    dep_network_id: {
      type: ObjectId,
      ref: "network",
      required: [true, "dep_network_id is required"],
    },
    dep_parent: { type: ObjectId, ref: "department" },
    dep_title: { type: String, required: [true, "dep_title is required"] },
    dep_status: { type: String, default: "inactive" },
    dep_manager: { type: ObjectId, ref: "user" },
    dep_last: { type: Number },
    dep_manager_username: { type: String },
    dep_manager_firstname: { type: String },
    dep_manager_lastname: { type: String },
    has_children: { type: String },
    dep_children: [
      {
        type: ObjectId,
        ref: "department",
      },
    ],
    dep_description: {
      type: String,
      required: [true, "dep_description is required"],
    },
    dep_users: [
      {
        type: ObjectId,
        ref: "user",
      },
    ],
  },
  {
    timestamps: true,
  }
);

DepartmentSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

DepartmentSchema.index({ dep_title: 1, dep_network_id: 1 }, { unique: true });

DepartmentSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      dep_parent: this.dep_parent,
      dep_title: this.dep_title,
      dep_network_id: this.dep_network_id,
      dep_status: this.dep_status,
      dep_manager: this.dep_manager,
      dep_last: this.dep_last,
      dep_manager_username: this.dep_manager_username,
      dep_manager_firstname: this.dep_manager_firstname,
      dep_manager_lastname: this.dep_manager_lastname,
      has_children: this.has_children,
      dep_children: this.dep_children,
      dep_users: this.dep_users,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
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

DepartmentSchema.statics = {
  async register(args) {
    try {
      let modifiedArgs = args;
      let tenant = modifiedArgs.tenant;
      if (tenant) {
        modifiedArgs["tenant"] = sanitizeName(tenant);
      }
      let data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "department created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message:
            "department NOT successfully created but operation successful",
          status: httpStatus.NO_CONTENT,
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
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "dep_users",
          foreignField: "_id",
          as: "dep_users",
        })
        .lookup({
          from: "departments",
          localField: "dep_children",
          foreignField: "_id",
          as: "dep_children",
        })
        .lookup({
          from: "networks",
          localField: "dep_network_id",
          foreignField: "_id",
          as: "network",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          dep_parent: 1,
          dep_title: 1,
          dep_status: 1,
          dep_manager: 1,
          dep_last: 1,
          dep_manager_username: 1,
          dep_manager_firstname: 1,
          dep_manager_lastname: 1,
          has_children: 1,
          dep_children: 1,
          createdAt: 1,
          dep_users: "$dep_users",
          dep_children: "$dep_children",
          network: { $arrayElemAt: ["$network", 0] },
        })
        .project({
          "network.__v": 0,
          "network.createdAt": 0,
          "network.updatedAt": 0,
        })
        .project({
          "dep_users.__v": 0,
          "dep_users.notifications": 0,
          "dep_users.emailConfirmed": 0,
          "dep_users.departments": 0,
          "dep_users.locationCount": 0,
          "dep_users.department": 0,
          "dep_users.long_department": 0,
          "dep_users.privilege": 0,
          "dep_users.userName": 0,
          "dep_users.password": 0,
          "dep_users.duration": 0,
          "dep_users.createdAt": 0,
          "dep_users.updatedAt": 0,
        })
        .project({
          "dep_children.__v": 0,
          "dep_children.createdAt": 0,
          "dep_children.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the departments",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "departments do not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (err) {
      logObject("err", err);
      let response = {};
      let errors = {};
      let message = "internal server error";
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
        errors = err.errors;
        status = httpStatus.CONFLICT;
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
      let modifiedUpdate = update;
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      if (modifiedUpdate.dep_users) {
        modifiedUpdate["$addToSet"]["dep_users"] = {};
        modifiedUpdate["$addToSet"]["dep_users"]["$each"] =
          modifiedUpdate.dep_users;
        delete modifiedUpdate["dep_users"];
      }

      if (modifiedUpdate.dep_children) {
        modifiedUpdate["$addToSet"]["dep_children"] = {};
        modifiedUpdate["$addToSet"]["dep_children"]["$each"] =
          modifiedUpdate.dep_children;
        delete modifiedUpdate["dep_children"];
      }

      let updatedDepartment = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedDepartment)) {
        return {
          success: true,
          message: "successfully modified the department",
          data: updatedDepartment._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedDepartment)) {
        return {
          success: true,
          message: "department does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
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
          dep_parent: 1,
          dep_title: 1,
        },
      };
      let removedDepartment = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedDepartment)) {
        return {
          success: true,
          message: "successfully removed the department",
          data: removedDepartment._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedDepartment)) {
        return {
          success: true,
          message: "department does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
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

module.exports = DepartmentSchema;
