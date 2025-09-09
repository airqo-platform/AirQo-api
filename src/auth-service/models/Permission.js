const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.ObjectId;
const { getModelByTenant } = require("@config/database");
const { logObject } = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- permission-model`);

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

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
    group_id: {
      type: ObjectId,
      ref: "group",
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
PermissionSchema.index({ permission: 1, group_id: 1 }, { unique: true });
PermissionSchema.index({ permission: 1 }, { unique: true });

PermissionSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "permission", {
          message: "Permission created",
        });
      } else {
        return createEmptySuccessResponse(
          "permission",
          "operation successful but Permission NOT successfully created"
        );
      }
    } catch (err) {
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

      // Handle specific duplicate key errors
      if (err.keyValue) {
        let response = {};
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
        return {
          success: false,
          message: "validation errors for some of the provided fields",
          status: httpStatus.CONFLICT,
          errors: response,
        };
      } else {
        return createErrorResponse(err, "create", logger, "permission");
      }
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const permissions = await this.aggregate()
        .match(filter)
        .sort({ createdAt: -1 })
        .lookup({
          from: "networks",
          localField: "network_id",
          foreignField: "_id",
          as: "network",
        })
        .lookup({
          from: "groups",
          localField: "group_id",
          foreignField: "_id",
          as: "group",
        })
        .project({
          _id: 1,
          permission: 1,
          description: 1,
          network: { $arrayElemAt: ["$network", 0] },
          group: { $arrayElemAt: ["$group", 0] },
        })
        .project({
          "network.__v": 0,
          "network.createdAt": 0,
          "network.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      return createSuccessResponse("list", permissions, "permission", {
        message: "successfully listed the permissions",
        emptyMessage: "no permissions exist",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "permission");
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      const modifiedUpdate = { ...update };

      // Remove permission field from update if present
      if (modifiedUpdate.permission) {
        delete modifiedUpdate.permission;
      }

      const updatedPermission = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedPermission)) {
        return createSuccessResponse(
          "update",
          updatedPermission._doc,
          "permission"
        );
      } else {
        return createNotFoundResponse(
          "permission",
          "update",
          "Permission does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "permission");
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: { _id: 0, permission: 1, description: 1 },
      };

      const removedPermission = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedPermission)) {
        return createSuccessResponse(
          "delete",
          removedPermission._doc,
          "permission"
        );
      } else {
        return createNotFoundResponse(
          "permission",
          "delete",
          "Permission does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "permission");
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
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const permissions = mongoose.model("permissions");
    return permissions;
  } catch (error) {
    const permissions = getModelByTenant(
      dbTenant,
      "permission",
      PermissionSchema
    );
    return permissions;
  }
};

module.exports = PermissionModel;
