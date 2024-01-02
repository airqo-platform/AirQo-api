const mongoose = require("mongoose").set("debug", true);
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- role-model`
);
const { HttpError } = require("@utils/errors");

const RoleSchema = new mongoose.Schema(
  {
    role_name: {
      type: String,
      required: [true, "name is required"],
      unique: true,
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
    role_permissions: [
      {
        type: ObjectId,
        ref: "permission",
        unique: true,
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

RoleSchema.index({ role_name: 1, role_code: 1 }, { unique: true });
RoleSchema.index(
  { role_name: 1, role_code: 1, network_id: 1 },
  { unique: true }
);
RoleSchema.index({ role_name: 1, network_id: 1 }, { unique: true });
RoleSchema.index({ role_code: 1, network_id: 1 }, { unique: true });

RoleSchema.statics = {
  async register(args, next) {
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
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      logObject("the error", err);
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

      logger.error(`Internal Server Error -- ${message}`);
      next(new HttpError(message, status, response));
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
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.role_permissions) {
        modifiedUpdate["$addToSet"]["role_permissions"] = {};
        modifiedUpdate["$addToSet"]["role_permissions"]["$each"] =
          modifiedUpdate.role_permissions;
        delete modifiedUpdate.role_permissions;
      }
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
        return {
          success: true,
          message: "successfully modified the Role",
          data: updatedRole._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedRole)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "role not foun, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Role does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
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
  try {
    const roles = mongoose.model("roles");
    return roles;
  } catch (error) {
    const roles = getModelByTenant(tenant, "role", RoleSchema);
    return roles;
  }
};

module.exports = RoleModel;
