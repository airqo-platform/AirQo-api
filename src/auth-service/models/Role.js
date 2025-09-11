const mongoose = require("mongoose").set("debug", true);
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.ObjectId;
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- role-model`
);
const { logObject, logText } = require("@utils/shared");

const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const RoleSchema = new mongoose.Schema(
  {
    role_name: {
      type: String,
      required: [true, "name is required"],
    },
    role_description: {
      type: String,
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
    network_id: {
      type: ObjectId,
      ref: "network",
    },
    group_id: {
      type: ObjectId,
      ref: "group",
    },
    role_permissions: [
      {
        type: ObjectId,
        ref: "permission",
      },
    ],
  },
  { timestamps: true }
);

RoleSchema.pre("save", async function (next) {
  try {
    return next();
  } catch (err) {
    next(err);
  }
});

RoleSchema.pre("update", function (next) {
  return next();
});

// Uniqueness when network scoped
RoleSchema.index(
  { role_name: 1, network_id: 1 },
  {
    unique: true,
    partialFilterExpression: { network_id: { $exists: true, $ne: null } },
  }
);
RoleSchema.index(
  { role_code: 1, network_id: 1 },
  {
    unique: true,
    partialFilterExpression: { network_id: { $exists: true, $ne: null } },
  }
);
// Uniqueness when group scoped
RoleSchema.index(
  { role_name: 1, group_id: 1 },
  {
    unique: true,
    partialFilterExpression: { group_id: { $exists: true, $ne: null } },
  }
);
RoleSchema.index(
  { role_code: 1, group_id: 1 },
  {
    unique: true,
    partialFilterExpression: { group_id: { $exists: true, $ne: null } },
  }
);

RoleSchema.statics = {
  async register(args, next) {
    try {
      logText("we are in the role model creating things");
      const newRole = await this.create({
        ...args,
      });

      if (!isEmpty(newRole)) {
        return createSuccessResponse("create", newRole._doc, "role", {
          message: "Role created",
        });
      } else {
        return createEmptySuccessResponse(
          "role",
          "operation successful but Role NOT successfully created"
        );
      }
    } catch (err) {
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      logObject("the error", err);
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);

      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;

      if (err.keyValue) {
        Object.entries(err.keyValue).forEach(([key, value]) => {
          return (response[key] = `the ${key} must be unique`);
        });
      } else if (err.errors) {
        Object.entries(err.errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      } else if (err.code === 11000) {
        logObject("err", err);
        const duplicate_record = args.role_name
          ? args.role_name
          : args.role_code;
        response[duplicate_record] = `${duplicate_record} must be unique`;
        response["message"] =
          "the role_name and role_code must be unique for every role";
      }

      return {
        success: false,
        message,
        status,
        errors: response,
      };
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.ROLES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.ROLES_EXCLUSION_PROJECTION(
        filter.category ? filter.category : ""
      );
      logObject("inclusionProjection", inclusionProjection);
      logObject("exclusionProjection", exclusionProjection);

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const roles = await this.aggregate()
        .match(filter)
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
        .lookup({
          from: "permissions",
          localField: "role_permissions",
          foreignField: "_id",
          as: "role_permissions",
        })
        .lookup({
          from: "users",
          localField: "_id",
          foreignField: "network_roles.role",
          as: "role_users",
        })
        .addFields({
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      return createSuccessResponse("list", roles, "role", {
        message: "successfully listed the roles",
        emptyMessage: "roles not found for this operation",
      });
    } catch (error) {
      return createErrorResponse(error, "list", logger, "role");
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      // Handle role_permissions with $addToSet
      if (modifiedUpdate.role_permissions) {
        modifiedUpdate["$addToSet"]["role_permissions"] = {};
        modifiedUpdate["$addToSet"]["role_permissions"]["$each"] =
          modifiedUpdate.role_permissions;
        delete modifiedUpdate.role_permissions;
      }

      // Remove fields that shouldn't be updated
      if (modifiedUpdate.role_name) {
        delete modifiedUpdate.role_name;
      }
      if (modifiedUpdate.role_code) {
        delete modifiedUpdate.role_code;
      }

      const updatedRole = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedRole)) {
        return createSuccessResponse("update", updatedRole._doc, "role");
      } else {
        return createNotFoundResponse(
          "role",
          "update",
          "role not found, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "update", logger, "role");
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: { _id: 0, role_name: 1, role_code: 1, role_status: 1 },
      };

      const removedRole = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedRole)) {
        logObject("removed roleee", removedRole);
        const data = removedRole._doc;
        return createSuccessResponse("delete", data, "role");
      } else {
        return createNotFoundResponse(
          "role",
          "delete",
          "Role does not exist, please crosscheck"
        );
      }
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "role");
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
      role_description: this.role_description,
      network_id: this.network_id,
    };
  },
};

const RoleModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const roles = mongoose.model("roles");
    return roles;
  } catch (error) {
    const roles = getModelByTenant(dbTenant, "role", RoleSchema);
    return roles;
  }
};

module.exports = RoleModel;
