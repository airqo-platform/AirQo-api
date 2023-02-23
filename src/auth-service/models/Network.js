const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
const validator = require("validator");
var uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("../utils/multitenancy");
const httpStatus = require("http-status");

const NetworkSchema = new Schema(
  {
    net_email: {
      type: String,
      unique: true,
      required: [true, "net_email is required"],
      trim: true,
      validate: {
        validator(net_email) {
          return validator.isEmail(net_email);
        },
        message: "{VALUE} is not a valid email!",
      },
    },
    net_parent: {
      type: ObjectId,
      ref: "network",
    },
    net_name: { type: String, required: [true, "net_name is required"] },
    net_status: { type: String, default: "inactive" },
    net_manager: { type: ObjectId },
    net_last: { type: Number },
    net_manager_username: { type: String },
    net_manager_firstname: { type: String },
    net_manager_lastname: { type: String },
    has_children: { type: Number },
    net_children: [{ type: ObjectId, ref: "network" }],
    net_phoneNumber: {
      type: Number,
      unique: true,
    },
    net_website: {
      type: String,
      unique: true,
    },
    net_description: {
      type: String,
      required: [true, "description is required"],
    },
    net_acronym: {
      type: String,
      required: [true, "net_acronym is required"],
      unique: true,
    },
    net_category: {
      type: String,
    },
    net_users: [
      {
        type: ObjectId,
        ref: "user",
      },
    ],
    net_departments: [
      {
        type: ObjectId,
        ref: "departments",
      },
    ],
    net_permissions: [
      {
        type: ObjectId,
        ref: "permissions",
      },
    ],
    net_roles: [
      {
        type: ObjectId,
        ref: "roles",
      },
    ],
    net_groups: [
      {
        type: ObjectId,
        ref: "groups",
      },
    ],
  },
  {
    timestamps: true,
  }
);

NetworkSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

NetworkSchema.index({ net_website: 1 }, { unique: true });
NetworkSchema.index({ net_email: 1 }, { unique: true });
NetworkSchema.index({ net_phoneNumber: 1 }, { unique: true });
NetworkSchema.index({ net_acronym: 1 }, { unique: true });
NetworkSchema.index({ net_name: 1 }, { unique: true });

NetworkSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      net_email: this.net_email,
      net_website: this.net_website,
      net_category: this.net_category,
      net_status: this.net_status,
      net_phoneNumber: this.net_phoneNumber,
      net_users: this.net_users,
      net_name: this.net_name,
      net_manager: this.net_manager,
      net_users: this.net_users,
      net_departments: this.net_departments,
      net_permissions: this.net_permissions,
      net_roles: this.net_roles,
      net_groups: this.net_groups,
      net_description: this.net_description,
      net_acronym: this.net_acronym,
      net_createdAt: this.createdAt,
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

NetworkSchema.statics = {
  async register(args) {
    try {
      let modifiedArgs = args;
      let tenant = modifiedArgs.tenant;
      if (tenant) {
        modifiedArgs["tenant"] = sanitizeName(tenant);
      }
      const data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "network created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message: "network NOT successfully created but operation successful",
          status: httpStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        Object.entries(err.keyValue).forEach(([key, value]) => {
          logObject("err.keyValue", err.keyValue);
          response[key] = value;
          response["message"] = "duplicate values provided";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        logObject("err.errors", err.errors);
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] =
            "input validation errors for some of the provided fields";
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
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "net_users",
          foreignField: "_id",
          as: "net_users",
        })
        .lookup({
          from: "permissions",
          localField: "net_permissions",
          foreignField: "_id",
          as: "net_permissions",
        })
        .lookup({
          from: "roles",
          localField: "net_roles",
          foreignField: "_id",
          as: "net_roles",
        })
        .lookup({
          from: "groups",
          localField: "net_groups",
          foreignField: "_id",
          as: "net_groups",
        })
        .lookup({
          from: "departments",
          localField: "net_departments",
          foreignField: "_id",
          as: "net_departments",
        })
        .lookup({
          from: "users",
          localField: "net_manager",
          foreignField: "_id",
          as: "net_manager",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          net_email: 1,
          net_website: 1,
          net_category: 1,
          net_status: 1,
          net_phoneNumber: 1,
          net_name: 1,
          net_description: 1,
          net_acronym: 1,
          createdAt: 1,
          net_manager: { $arrayElemAt: ["$net_manager", 0] },
          net_users: "$net_users",
          net_permissions: "$net_permissions",
          net_roles: "$net_roles",
          net_groups: "$net_groups",
          net_departments: "$net_departments",
        })
        .project({
          "net_users.__v": 0,
          "net_users.notifications": 0,
          "net_users.emailConfirmed": 0,
          "net_users.networks": 0,
          "net_users.locationCount": 0,
          "net_users.network": 0,
          "net_users.long_network": 0,
          "net_users.privilege": 0,
          "net_users.userName": 0,
          "net_users.password": 0,
          "net_users.duration": 0,
          "net_users.createdAt": 0,
          "net_users.updatedAt": 0,
        })
        .project({
          "net_manager.__v": 0,
          "net_manager.notifications": 0,
          "net_manager.emailConfirmed": 0,
          "net_manager.networks": 0,
          "net_manager.locationCount": 0,
          "net_manager.network": 0,
          "net_manager.long_network": 0,
          "net_manager.privilege": 0,
          "net_manager.userName": 0,
          "net_manager.password": 0,
          "net_manager.duration": 0,
          "net_manager.createdAt": 0,
          "net_manager.updatedAt": 0,
          "net_manager.groups": 0,
          "net_manager.roles": 0,
          "net_manager.permissions": 0,
        })
        .project({
          "net_permissions.__v": 0,
          "net_permissions.createdAt": 0,
          "net_permissions.updatedAt": 0,
        })
        .project({
          "net_roles.__v": 0,
          "net_roles.createdAt": 0,
          "net_roles.updatedAt": 0,
        })
        .project({
          "net_groups.__v": 0,
          "net_groups.createdAt": 0,
          "net_groups.updatedAt": 0,
        })
        .project({
          "net_departments.__v": 0,
          "net_departments.createdAt": 0,
          "net_departments.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the network details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message:
            "No network details exist for this operation, please crosscheck",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (err) {
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
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

  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = Object.assign({}, update);

      logObject("modifiedUpdate", modifiedUpdate);

      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      if (modifiedUpdate.net_departments) {
        modifiedUpdate["$addToSet"] = {};
        modifiedUpdate["$addToSet"]["net_departments"] = {};
        modifiedUpdate["$addToSet"]["net_departments"]["$each"] =
          modifiedUpdate.net_departments;
        delete modifiedUpdate["net_departments"];
      }

      if (modifiedUpdate.net_groups) {
        modifiedUpdate["$addToSet"] = {};
        modifiedUpdate["$addToSet"]["net_groups"] = {};
        modifiedUpdate["$addToSet"]["net_groups"]["$each"] =
          modifiedUpdate.net_groups;
        delete modifiedUpdate["net_groups"];
      }

      if (modifiedUpdate.net_permissions) {
        modifiedUpdate["$addToSet"] = {};
        modifiedUpdate["$addToSet"]["net_permissions"] = {};
        modifiedUpdate["$addToSet"]["net_permissions"]["$each"] =
          modifiedUpdate.net_permissions;
        delete modifiedUpdate["net_permissions"];
      }

      if (modifiedUpdate.net_roles) {
        modifiedUpdate["$addToSet"] = {};
        modifiedUpdate["$addToSet"]["net_roles"] = {};
        modifiedUpdate["$addToSet"]["net_roles"]["$each"] =
          modifiedUpdate.net_roles;
        delete modifiedUpdate["net_roles"];
      }

      logObject("modifiedUpdate", modifiedUpdate);
      logObject("filter", filter);

      const updatedNetwork = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      logObject("updatedNetwork", updatedNetwork);

      if (!isEmpty(updatedNetwork)) {
        return {
          success: true,
          message: "successfully modified the network",
          data: updatedNetwork._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedNetwork)) {
        return {
          success: true,
          message: "No networks exist for this operation",
          status: httpStatus.OK,
          errors: { message: "No networks exist for this operation" },
        };
      }
    } catch (err) {
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.code) &&
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      } else if (
        !isEmpty(err.code) &&
        !isEmpty(err.codeName) &&
        (err.code === 13 || err.codeName === "Unauthorized")
      ) {
        response["message"] = "Unauthorized to carry out this operation";
        return response;
      }
      logObject("err", err);

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
          net_email: 1,
          net_website: 1,
          net_name: 1,
          net_manager: 1,
        },
      };
      const removedNetwork = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedNetwork)) {
        return {
          success: true,
          message: "successfully removed the network",
          data: removedNetwork._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedNetwork)) {
        return {
          success: true,
          message: "Network does not exist for this operation",
          status: httpStatus.OK,
          errors: { message: "Network does not exist for this operation" },
        };
      }
    } catch (err) {
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.code) &&
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
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

module.exports = NetworkSchema;
