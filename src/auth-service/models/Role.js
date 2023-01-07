const mongoose = require("mongoose").set("debug", true);
const { logObject, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;

const RoleSchema = new mongoose.Schema(
  {
    role_name: {
      type: String,
      required: [true, "name is required"],
    },
    role_status: {
      type: String,
      required: [true, "name is required"],
      default: "ACTIVE",
    },
    role_code: {
      type: String,
      trim: true,
    },
    role_permissions: [
      {
        type: ObjectId,
        ref: "permission",
      },
    ],
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

RoleSchema.index({ role_name: 1 }, { unique: true });

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
      }

      return {
        error: response,
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
        };
      } else if (isEmpty(roles)) {
        return {
          success: true,
          message: "no roles exist",
          data: [],
        };
      } else {
        return {
          success: false,
          message: "unable to retrieve roles",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Role model server error - list",
        error: error.message,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.permissions) {
        modifiedUpdate["$addToSet"]["permissions"] = {};
        modifiedUpdate["$addToSet"]["permissions"]["$each"] =
          modifiedUpdate.permissions;
        delete modifiedUpdate["permissions"];
      }

      let updatedRole = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      if (!isEmpty(updatedRole)) {
        let data = updatedRole._doc;
        return {
          success: true,
          message: "successfully modified the Role",
          data,
        };
      } else {
        return {
          success: false,
          message: "Role does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Role model server error - modify",
        error: error.message,
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
        };
      } else {
        return {
          success: false,
          message: "Role does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Role model server error - remove",
        error: error.message,
      };
    }
  },
};

RoleSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
    };
  },
};

module.exports = RoleSchema;
