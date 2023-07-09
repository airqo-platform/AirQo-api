const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;

const PermissionSchema = new mongoose.Schema(
  {
    permission: {
      type: String,
      required: [true, "permission is required"],
      unique: true,
    },
    network_id: {
      type: ObjectId,
      ref: "network",
    },
    description: { type: String, required: [true, "description is required"] },
  },
  { timestamps: true }
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

PermissionSchema.index({ permission: 1, network_id: 1 }, { unique: true });
PermissionSchema.index({ permission: 1 }, { unique: true });

PermissionSchema.statics = {
  async register(args) {
    try {
      data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "Permission created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message:
            "operation successful but Permission NOT successfully created",
          status: httpStatus.ACCEPTED,
        };
      }
    } catch (err) {
      logObject("the error", err);
      let response = {};
      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      }
      return {
        success: false,
        error: response,
        errors: response,
        message: "validation errors for some of the provided fields",
        status: httpStatus.CONFLICT,
      };
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      let permissions = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .lookup({
          from: "networks",
          localField: "network_id",
          foreignField: "_id",
          as: "network",
        })
        .project({
          _id: 1,
          permission: 1,
          description: 1,
          network: { $arrayElemAt: ["$network", 0] },
        })
        .project({
          "network.__v": 0,
          "network.createdAt": 0,
          "network.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);
      if (!isEmpty(permissions)) {
        let data = permissions;
        return {
          success: true,
          data,
          message: "successfully listed the permissions",
          status: httpStatus.OK,
        };
      } else if (isEmpty(permissions)) {
        return {
          success: true,
          message: "no permissions exist",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server error",
        error: error.message,
        errors: { message: "internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;

      if (modifiedUpdate.permission) {
        delete modifiedUpdate.permission;
      }

      const updatedPermission = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedPermission)) {
        return {
          success: true,
          message: "successfully modified the Permission",
          data: updatedPermission._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedPermission)) {
        return {
          success: true,
          message: "Permission does not exist, please crosscheck",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server error",
        error: error.message,
        errors: { message: "internal server error", error: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, permission: 1, description: 1 },
      };
      let removedPermission = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedPermission)) {
        return {
          success: true,
          message: "successfully removed the Permission",
          data: removedPermission._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedPermission)) {
        return {
          success: true,
          message: "Permission does not exist, please crosscheck",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server error",
        error: error.message,
        errors: { message: "internal server error", error: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

PermissionSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      permission: this.permission,
      description: this.description,
    };
  },
};

module.exports = PermissionSchema;
