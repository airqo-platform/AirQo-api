const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * A user belongs to many permissions.
 * A Permission belongs to many users
 */

const UserPermissionSchema = new mongoose.Schema(
  {
    user_id: { type: ObjectId },
    permission_id: { type: ObjectId },
  },
  { timestamps: false }
);

UserPermissionSchema.pre("save", function (next) {
  return next();
});

UserPermissionSchema.pre("findOneAndUpdate", function () {
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

UserPermissionSchema.pre("update", function (next) {
  return next();
});

UserPermissionSchema.index({ name: 1 }, { unique: true });

UserPermissionSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (data) {
        return {
          success: true,
          data,
          message: "UserPermission created",
        };
      }
      return {
        success: true,
        data,
        message:
          "operation successful but UserPermission NOT successfully created",
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
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "users",
        })
        .lookup({
          from: "permissions",
          localField: "permission_id",
          foreignField: "_id",
          as: "permissions",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          user_id: 1,
          permission_id: 1,
          roles: "$users",
          permissions: "$permissions",
        })
        .project({
          "users.__v": 0,
        })
        .project({
          "permissions.__v": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);
      if (!isEmpty(response)) {
        let data = response;
        return {
          success: true,
          message: "successfully retrieved the userPermission details",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "userPermission/s do not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      let updatedUserPermission = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      if (!isEmpty(updatedUserPermission)) {
        let data = updatedUserPermission._doc;
        return {
          success: true,
          message: "successfully modified the UserPermission",
          data,
        };
      } else {
        return {
          success: false,
          message: "UserPermission does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "UserPermission model server error - modify",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, name: 1 },
      };
      let removedUserPermission = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedUserPermission)) {
        let data = removedUserPermission._doc;
        return {
          success: true,
          message: "successfully removed the UserPermission",
          data,
        };
      } else {
        return {
          success: false,
          message: "UserPermission does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "UserPermission model server error - remove",
        error: error.message,
      };
    }
  },
};

UserPermissionSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      user_id: this.user_id,
      permission_id: this.permission_id,
    };
  },
};

module.exports = UserPermissionSchema;
