const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");

const PermissionSchema = new mongoose.Schema(
  {
    name: { type: String, unique: true },
  },
  { timestamps: false }
);

PermissionSchema.pre("save", function (next) {
  return next();
});

PermissionSchema.pre("findOneAndUpdate", function () {
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

PermissionSchema.pre("update", function (next) {
  return next();
});

PermissionSchema.index({ name: 1 }, { unique: true });

PermissionSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (data) {
        return {
          success: true,
          data,
          message: "Permission created",
        };
      }
      return {
        success: true,
        data,
        message: "operation successful but Permission NOT successfully created",
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
      let permissions = await this.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec();
      if (!isEmpty(permissions)) {
        let data = permissions;
        return {
          success: true,
          data,
          message: "successfully listed the permissions",
        };
      }

      if (isEmpty(data)) {
        return {
          success: true,
          message: "no permissions exist",
          data,
        };
      }
      return {
        success: false,
        message: "unable to retrieve permissions",
        data,
      };
    } catch (error) {
      return {
        success: false,
        message: "Permission model server error - list",
        error: error.message,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      let updatedPermission = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      if (!isEmpty(updatedPermission)) {
        let data = updatedPermission._doc;
        return {
          success: true,
          message: "successfully modified the Permission",
          data,
        };
      } else {
        return {
          success: false,
          message: "Permission does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Permission model server error - modify",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, name: 1 },
      };
      let removedPermission = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedPermission)) {
        let data = removedPermission._doc;
        return {
          success: true,
          message: "successfully removed the Permission",
          data,
        };
      } else {
        return {
          success: false,
          message: "Permission does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Permission model server error - remove",
        error: error.message,
      };
    }
  },
};

PermissionSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      name: this.name,
    };
  },
};

module.exports = PermissionSchema;
