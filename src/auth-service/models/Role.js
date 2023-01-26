const mongoose = require("mongoose").set("debug", true);
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;

const RoleSchema = new mongoose.Schema(
  {
    role_name: {
      type: String,
      required: [true, "name is required"],
      unique: true,
    },
    role_status: {
      type: String,
      required: [true, "name is required"],
      default: "ACTIVE",
    },
    role_code: {
      type: String,
      trim: true,
      unique: true,
    },
    role_permissions: {
      type: Array,
      default: [],
    },
    role_users: [
      {
        type: ObjectId,
        ref: "user",
      },
    ],
  },
  { timestamps: false }
);

RoleSchema.pre("save", function (next) {
  return next();
});

RoleSchema.pre("findOneAndUpdate", function () {
  let that = this;
  const update = that.getUpdate();
  if (update.__v != null) {
    delete update.__v;
  }
  const keys = ["$set", "$setOnInsert"];
  for (const key of keys) {
    if (update[key] != null && update[key].__v != null) {
      delete update[key].__v;
      if (Object.keys(update[key]).length === 0) {
        delete update[key];
      }
    }
  }
  update.$inc = update.$inc || {};
  update.$inc.__v = 1;
});

RoleSchema.pre("update", function (next) {
  return next();
});

RoleSchema.index({ role_name: 1, role_code: 1 }, { unique: true });

RoleSchema.statics = {
  async register(args) {
    try {
      logText("we are in the role model creating things");
      const newRole = await this.create({
        ...args,
      });
      if (!isEmpty(newRole)) {
        return {
          success: true,
          data: newRole._doc,
          message: "Role created",
        };
      } else if (isEmpty(newRole)) {
        return {
          success: true,
          data: [],
          message: "operation successful but Role NOT successfully created",
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else if (err.code === 11000) {
        logObject("JSON.parse(err)", JSON.parse(err));
        const duplicate_record = args.role_name
          ? args.role_name
          : args.role_code;
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] =
          "the role_name and role_code must be unique for every role";
      }

      return {
        error: response,
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },

  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      const roles = await this.aggregate()
        .match(filter)
        .lookup({
          from: "networks",
          localField: "network_id",
          foreignField: "_id",
          as: "network",
        })
        .lookup({
          from: "permissions",
          localField: "role_permissions",
          foreignField: "permission",
          as: "role_permissions",
        })
        .sort({ createdAt: -1 })
        .project({
          "network.__v": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(roles)) {
        return {
          success: true,
          data: roles,
          message: "successfully listed the roles",
          status: httpStatus.OK,
        };
      } else if (isEmpty(roles)) {
        return {
          success: true,
          message: "roles not found for this operation",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Role model server error - list",
        error: error.message,
        errors: { message: error.message },
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.permissions) {
        modifiedUpdate["$addToSet"]["role_permissions"] = {};
        modifiedUpdate["$addToSet"]["role_permissions"]["$each"] =
          modifiedUpdate.permissions;
        delete modifiedUpdate.permissions;
      }
      const updatedRole = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "successfully modified the Role",
          data: updatedRole._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedRole)) {
        return {
          success: true,
          message: "role not found",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server errors",
        error: error.message,
        errors: { message: "internal server errors" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, role_name: 1, role_code: 1, role_status: 1 },
      };
      let removedRole = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedRole)) {
        logObject("removed roleee", removedRole);
        let data = removedRole._doc;
        return {
          success: true,
          message: "successfully removed the Role",
          data,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "Role does not exist, please crosscheck",
          data: [],
          status: httpStatus.NOT_FOUND,
          errors: { message: "Role does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server errors",
        error: error.message,
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

RoleSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      role_name: this.role_name,
      role_code: this.role_code,
      role_status: this.role_status,
      role_permissions: this.role_permissions,
    };
  },
};

module.exports = RoleSchema;
