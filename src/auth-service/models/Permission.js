const mongoose = require("mongoose").set("debug", true);
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const { HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- permission-model`);

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

PermissionSchema.pre("update", function (next) {
  return next();
});

PermissionSchema.index({ permission: 1, network_id: 1 }, { unique: true });
PermissionSchema.index({ permission: 1 }, { unique: true });

PermissionSchema.statics = {
  async register(args, next) {
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
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(
        new HttpError(
          "validation errors for some of the provided fields",
          httpStatus.CONFLICT,
          response
        )
      );
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
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
      next(
        new HttpError(
          "internal server error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
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
      next(
        new HttpError(
          "internal server error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
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
      next(
        new HttpError(
          "internal server error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
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

const PermissionModel = (tenant) => {
  try {
    const permissions = mongoose.model("permissions");
    return permissions;
  } catch (error) {
    const permissions = getModelByTenant(
      tenant,
      "permission",
      PermissionSchema
    );
    return permissions;
  }
};

module.exports = PermissionModel;
