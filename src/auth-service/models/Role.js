const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");

const RoleSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true },
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

RoleSchema.index({ name: 1 }, { unique: true });

RoleSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (data) {
        return {
          success: true,
          data,
          message: "Role created",
        };
      }
      return {
        success: true,
        data,
        message: "operation successful but Role NOT successfully created",
      };
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
      let roles = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      if (!isEmpty(roles)) {
        let data = roles;
        return {
          success: true,
          data,
          message: "successfully listed the roles",
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "no roles exist",
          data,
        };
      }
      return {
        success: false,
        message: "unable to retrieve roles",
        data,
      };
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
        projection: { _id: 0, name: 1 },
      };
      let removedRole = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedRole)) {
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
