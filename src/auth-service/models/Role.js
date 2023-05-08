const mongoose = require("mongoose").set("debug", true);
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const ObjectId = mongoose.Schema.Types.ObjectId;

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
      required: [true, "network_id is required"],
    },
    role_permissions: {
      type: Array,
      default: [],
    },
    role_users: [
      {
        type: ObjectId,
        ref: "user",
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
    // Handle errors
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
        error: response,
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const projectAll = {
        role_name: 1,
        role_description: 1,
        role_status: 1,
        role_code: 1,
        network_id: 1,
        role_permissions: 1,
        role_users: 1,
        network: { $arrayElemAt: ["$network", 0] },
        createdAt: 1,
        updatedAt: 1,
      };
      const roles = await this.aggregate()
        .match(filter)
        .lookup({
          from: "networks",
          localField: "network_id",
          foreignField: "_id",
          as: "network",
        })
        .lookup({
          from: "permissions",
          localField: "role_permissions",
          foreignField: "permission",
          as: "role_permissions",
        })
        .lookup({
          from: "users",
          localField: "_id",
          foreignField: "role",
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
        .project(projectAll)
        .project({
          "role_users.notifications": 0,
          "role_users.emailConfirmed": 0,
          "role_users.locationCount": 0,
          "role_users.password": 0,
          "role_users.privilege": 0,
          "role_users.organization": 0,
          "role_users.duration": 0,
          "role_users.__v": 0,
          "role_users.phoneNumber": 0,
          "role_users.profilePicture": 0,
          "role_users.resetPasswordExpires": 0,
          "role_users.resetPasswordToken": 0,
          "role_users.updatedAt": 0,
          "role_users.role": 0,
          "role_users.interest": 0,
          "role_users.org_name": 0,
          "role_users.accountStatus": 0,
          "role_users.hasAccess": 0,
          "role_users.collaborators": 0,
          "role_users.publisher": 0,
          "role_users.bus_nature": 0,
          "role_users.org_department": 0,
          "role_users.uni_faculty": 0,
          "role_users.uni_course_yr": 0,
          "role_users.pref_locations": 0,
          "role_users.job_title": 0,
          "role_users.userName": 0,
          "role_users.product": 0,
          "role_users.website": 0,
          "role_users.description": 0,
          "role_users.networks": 0,
          "role_users.jobTitle": 0,
          "role_users.category": 0,
          "role_users.long_organization": 0,
        })
        .project({
          "network.__v": 0,
          "network.net_status": 0,
          "network.net_children": 0,
          "network.net_users": 0,
          "network.net_departments": 0,
          "network.net_permissions": 0,
          "network.net_roles": 0,
          "network.net_groups": 0,
          "network.net_email": 0,
          "network.net_phoneNumber": 0,
          "network.net_category": 0,
          "network.createdAt": 0,
          "network.updatedAt": 0,
        })
        .project({
          "role_permissions.description": 0,
          "role_permissions.createdAt": 0,
          "role_permissions.updatedAt": 0,
          "role_permissions.__v": 0,
        })
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
      return {
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.permissions) {
        modifiedUpdate["$addToSet"]["role_permissions"] = {};
        modifiedUpdate["$addToSet"]["role_permissions"]["$each"] =
          modifiedUpdate.permissions;
        delete modifiedUpdate.permissions;
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
        return {
          success: true,
          message: "role not found",
          data: [],
          status: httpStatus.NOT_FOUND,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server errors",
        error: error.message,
        errors: { message: "internal server errors" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: "Role does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
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

module.exports = RoleSchema;
