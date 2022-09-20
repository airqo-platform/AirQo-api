const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;

/**
 * A role belongs to many permissions.
 * A Permission belongs to many roles
 */

const RolePermissionSchema = new mongoose.Schema(
  {
    role_id: { type: ObjectId },
    permission_id: { type: ObjectId },
  },
  { timestamps: false }
);

RolePermissionSchema.pre("save", function (next) {
  return next();
});

RolePermissionSchema.pre("findOneAndUpdate", function () {
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

RolePermissionSchema.pre("update", function (next) {
  return next();
});

RolePermissionSchema.index({ name: 1 }, { unique: true });

RolePermissionSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (data) {
        return {
          success: true,
          data,
          message: "RolePermission created",
        };
      }
      return {
        success: true,
        data,
        message:
          "operation successful but RolePermission NOT successfully created",
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

  async vlist({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "roles",
          localField: "role_id",
          foreignField: "_id",
          as: "roles",
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
          role_id: 1,
          permission_id: 1,
          roles: "$roles",
          permissions: "$permissions",
        })
        .project({
          "roles.__v": 0,
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
          message: "successfully retrieved the rolePermission details",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "rolePermission/s do not exist, please crosscheck",
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
      let updatedRolePermission = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      if (!isEmpty(updatedRolePermission)) {
        let data = updatedRolePermission._doc;
        return {
          success: true,
          message: "successfully modified the RolePermission",
          data,
        };
      } else {
        return {
          success: false,
          message: "RolePermission does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "RolePermission model server error - modify",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, name: 1 },
      };
      let removedRolePermission = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedRolePermission)) {
        let data = removedRolePermission._doc;
        return {
          success: true,
          message: "successfully removed the RolePermission",
          data,
        };
      } else {
        return {
          success: false,
          message: "RolePermission does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "RolePermission model server error - remove",
        error: error.message,
      };
    }
  },
};

RolePermissionSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      role_id: this.role_id,
      permission_id: this.permission_id,
    };
  },
};

module.exports = RolePermissionSchema;
