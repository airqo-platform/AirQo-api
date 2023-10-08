const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
const validator = require("validator");
var uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");

const GroupSchema = new Schema(
  {
    grp_title: {
      type: String,
      unique: true,
      required: [true, "grp_title is required"],
    },
    grp_status: { type: String, default: "INACTIVE" },
    grp_tasks: { type: Number },
    grp_description: {
      type: String,
      required: [true, "grp_description is required"],
    },
  },
  {
    timestamps: true,
  }
);

GroupSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

GroupSchema.index({ grp_title: 1 }, { unique: true });

GroupSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      grp_title: this.grp_title,
      grp_status: this.grp_status,
      grp_tasks: this.grp_tasks,
      grp_description: this.grp_description,
      createdAt: this.createdAt,
    };
  },
};

const convertToLowerCaseWithUnderscore = (inputString) => {
  try {
    const uppercaseString = inputString.toLowerCase();
    const transformedString = uppercaseString.replace(/ /g, "_");
    return transformedString;
  } catch (error) {
    logger.error(`Internal Server Error --  ${JSON.stringify(error)}`);
  }
};

GroupSchema.statics = {
  async register(args) {
    try {
      let modifiedArgs = Object.assign({}, args);

      if (modifiedArgs.grp_title) {
        modifiedArgs.grp_title = convertToLowerCaseWithUnderscore(
          modifiedArgs.grp_title
        );
      }
      const data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "group created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data,
          message: "group NOT successfully created but operation successful",
          status: httpStatus.ACCEPTED,
        };
      }
    } catch (err) {
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        success: false,
        errors: response,
        message,
        status,
      };
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      logObject("filter", filter);
      const inclusionProjection = constants.GROUPS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.GROUPS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }

      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "_id",
          foreignField: "groups.group",
          as: "grp_users",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the groups",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "groups do not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          data: [],
          errors: { message: "unable to retrieve groups" },
        };
      }
    } catch (err) {
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },

  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};

      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      if (modifiedUpdate.grp_title) {
        delete modifiedUpdate.grp_title;
      }

      const updatedGroup = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedGroup)) {
        return {
          success: true,
          message: "successfully modified the group",
          data: updatedGroup._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedGroup)) {
        return {
          success: true,
          message: "group does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Not Found" },
          data: [],
        };
      }
    } catch (err) {
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: {
          _id: 1,
          grp_title: 1,
          grp_status: 1,
          grp_description: 1,
          createdAt: 1,
        },
      };
      const removedGroup = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedGroup)) {
        return {
          success: true,
          message: "successfully removed the group",
          data: removedGroup._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedGroup)) {
        return {
          success: true,
          message: "group does not exist, please crosscheck",
          status: httpStatus.NOT_FOUND,
          errors: { message: "Not Found" },
          data: [],
        };
      }
    } catch (err) {
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = httpStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = httpStatus.CONFLICT;
        errors = err.errors;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value.message);
        });
      }
      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
};

const GroupModel = (tenant) => {
  try {
    let groups = mongoose.model("groups");
    return groups;
  } catch (error) {
    let groups = getModelByTenant(tenant, "group", GroupSchema);
    return groups;
  }
};

module.exports = GroupModel;
