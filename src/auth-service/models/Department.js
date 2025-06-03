const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- department-model`);
const { logObject, logElement } = require("@utils/shared");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

const DepartmentSchema = new Schema(
  {
    dep_network_id: {
      type: ObjectId,
      ref: "network",
      required: [true, "dep_network_id is required"],
    },
    dep_parent: { type: ObjectId, ref: "department" },
    dep_title: { type: String, required: [true, "dep_title is required"] },
    dep_status: { type: String, default: "inactive" },
    dep_manager: { type: ObjectId, ref: "user" },
    dep_last: { type: Number },
    dep_manager_username: { type: String },
    dep_manager_firstname: { type: String },
    dep_manager_lastname: { type: String },
    has_children: { type: String },
    dep_children: [
      {
        type: ObjectId,
        ref: "department",
      },
    ],
    dep_description: {
      type: String,
      required: [true, "dep_description is required"],
    },
    dep_users: [
      {
        type: ObjectId,
        ref: "user",
      },
    ],
  },
  {
    timestamps: true,
  }
);

DepartmentSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

DepartmentSchema.index({ dep_title: 1, dep_network_id: 1 }, { unique: true });

DepartmentSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      dep_parent: this.dep_parent,
      dep_title: this.dep_title,
      dep_network_id: this.dep_network_id,
      dep_status: this.dep_status,
      dep_manager: this.dep_manager,
      dep_last: this.dep_last,
      dep_manager_username: this.dep_manager_username,
      dep_manager_firstname: this.dep_manager_firstname,
      dep_manager_lastname: this.dep_manager_lastname,
      has_children: this.has_children,
      dep_children: this.dep_children,
      dep_users: this.dep_users,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const sanitizeName = (name) => {
  try {
    let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
    let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
    let trimmedName = shortenedName.trim();
    return trimmedName.toLowerCase();
  } catch (error) {
    logElement("the sanitise name error", error.message);
  }
};

DepartmentSchema.statics = {
  async register(args, next) {
    try {
      let modifiedArgs = args;
      let tenant = modifiedArgs.tenant;

      // Preserve tenant sanitization logic
      if (tenant) {
        modifiedArgs["tenant"] = sanitizeName(tenant);
      }

      const data = await this.create({
        ...modifiedArgs,
      });

      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "department", {
          message: "department created",
        });
      } else {
        return createEmptySuccessResponse(
          "department",
          "department NOT successfully created but operation successful"
        );
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      return createErrorResponse(err, "create", logger, "department");
    }
  },

  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "dep_users",
          foreignField: "_id",
          as: "dep_users",
        })
        .lookup({
          from: "departments",
          localField: "dep_children",
          foreignField: "_id",
          as: "dep_children",
        })
        .lookup({
          from: "networks",
          localField: "dep_network_id",
          foreignField: "_id",
          as: "network",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          dep_parent: 1,
          dep_title: 1,
          dep_status: 1,
          dep_manager: 1,
          dep_last: 1,
          dep_manager_username: 1,
          dep_manager_firstname: 1,
          dep_manager_lastname: 1,
          has_children: 1,
          dep_children: 1,
          createdAt: 1,
          dep_users: "$dep_users",
          dep_children: "$dep_children",
          network: { $arrayElemAt: ["$network", 0] },
        })
        .project({
          "network.__v": 0,
          "network.createdAt": 0,
          "network.updatedAt": 0,
        })
        .project({
          "dep_users.__v": 0,
          "dep_users.notifications": 0,
          "dep_users.emailConfirmed": 0,
          "dep_users.departments": 0,
          "dep_users.locationCount": 0,
          "dep_users.department": 0,
          "dep_users.long_department": 0,
          "dep_users.privilege": 0,
          "dep_users.userName": 0,
          "dep_users.password": 0,
          "dep_users.duration": 0,
          "dep_users.createdAt": 0,
          "dep_users.updatedAt": 0,
        })
        .project({
          "dep_children.__v": 0,
          "dep_children.createdAt": 0,
          "dep_children.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      return createSuccessResponse("list", response, "department", {
        message: "successfully retrieved the departments",
        emptyMessage: "departments do not exist, please crosscheck",
      });
    } catch (err) {
      logObject("err", err);
      return createErrorResponse(err, "list", logger, "department");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };
      let modifiedUpdate = { ...update };
      modifiedUpdate["$addToSet"] = {};

      // Remove tenant from update
      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      // Handle dep_users array with $addToSet
      if (modifiedUpdate.dep_users) {
        modifiedUpdate["$addToSet"]["dep_users"] = {};
        modifiedUpdate["$addToSet"]["dep_users"]["$each"] =
          modifiedUpdate.dep_users;
        delete modifiedUpdate["dep_users"];
      }

      // Handle dep_children array with $addToSet
      if (modifiedUpdate.dep_children) {
        modifiedUpdate["$addToSet"]["dep_children"] = {};
        modifiedUpdate["$addToSet"]["dep_children"]["$each"] =
          modifiedUpdate.dep_children;
        delete modifiedUpdate["dep_children"];
      }

      const updatedDepartment = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedDepartment)) {
        return createSuccessResponse(
          "update",
          updatedDepartment._doc,
          "department"
        );
      } else {
        return createNotFoundResponse(
          "department",
          "update",
          "The provided department does not exist, please crosscheck"
        );
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      return createErrorResponse(err, "update", logger, "department");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const options = {
        projection: {
          _id: 1,
          dep_parent: 1,
          dep_title: 1,
        },
      };

      const removedDepartment = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedDepartment)) {
        return createSuccessResponse(
          "delete",
          removedDepartment._doc,
          "department"
        );
      } else {
        return createNotFoundResponse(
          "department",
          "delete",
          "The department does not exist, please crosscheck"
        );
      }
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error ${err.message}`);
      return createErrorResponse(err, "delete", logger, "department");
    }
  },
};

const DepartmentModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let departments = mongoose.model("departments");
    return departments;
  } catch (error) {
    let departments = getModelByTenant(
      dbTenant,
      "department",
      DepartmentSchema
    );
    return departments;
  }
};

module.exports = DepartmentModel;
