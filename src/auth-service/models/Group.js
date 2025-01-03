const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
const validator = require("validator");
var uniqueValidator = require("mongoose-unique-validator");
const { logObject, logText, logElement } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- group-model`);

function validateProfilePicture(grp_profile_picture) {
  const urlRegex =
    /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
  if (!urlRegex.test(grp_profile_picture)) {
    logger.error(`🙅🙅 Bad Request Error -- Not a valid profile picture URL`);
    return false;
  }
  if (grp_profile_picture.length > 200) {
    logText("longer than 200 chars");
    logger.error(
      `🙅🙅 Bad Request Error -- profile picture URL exceeds 200 characters`
    );
    return false;
  }
  return true;
}

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
    grp_manager: { type: ObjectId },
    grp_manager_username: { type: String },
    grp_manager_firstname: { type: String },
    grp_manager_lastname: { type: String },
    grp_website: { type: String },
    grp_industry: { type: String },
    grp_country: { type: String },
    grp_timezone: { type: String },
    grp_image: { type: String },
    grp_profile_picture: {
      type: String,
      maxLength: 200,
      validate: {
        validator: function (v) {
          const urlRegex =
            /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
          return urlRegex.test(v);
        },
        message:
          "Profile picture URL must be a valid URL & must not exceed 200 characters.",
      },
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

GroupSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany", "update", "save"],
  async function (next) {
    // Determine if this is a new document or an update
    const isNew = this.isNew;
    let updates = this.getUpdate ? this.getUpdate() : this;

    try {
      // Validation only for new documents
      if (isNew) {
        if (
          this.grp_profile_picture &&
          !validateProfilePicture(this.grp_profile_picture)
        ) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid profile picture URL",
            })
          );
        }
      }
      return next();
    } catch (error) {
      return next(error);
    }
  }
);

GroupSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      grp_title: this.grp_title,
      grp_status: this.grp_status,
      grp_tasks: this.grp_tasks,
      grp_description: this.grp_description,
      createdAt: this.createdAt,
      grp_manager: this.grp_manager,
      grp_manager_username: this.grp_manager_username,
      grp_manager_firstname: this.grp_manager_firstname,
      grp_manager_lastname: this.grp_manager_lastname,
      grp_website: this.grp_website,
      grp_profile_picture: this.grp_profile_picture,
      grp_industry: this.grp_industry,
      grp_country: this.grp_country,
      grp_timezone: this.grp_timezone,
      grp_image: this.grp_image,
    };
  },
};

const convertToLowerCaseWithUnderscore = (inputString) => {
  try {
    const uppercaseString = inputString.toLowerCase();
    const transformedString = uppercaseString.replace(/ /g, "_");
    return transformedString;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error --  ${JSON.stringify(error)}`);
  }
};

GroupSchema.statics = {
  async register(args, next) {
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
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
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
          foreignField: "group_roles.group",
          as: "grp_users",
        })
        .lookup({
          from: "users",
          localField: "grp_manager",
          foreignField: "_id",
          as: "grp_manager",
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

      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "group does not exist, please crosscheck -- Not Found",
          })
        );
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
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async remove({ filter = {} } = {}, next) {
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
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Bad Request, Group Not Found -- please crosscheck",
          })
        );
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
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
};

const GroupModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let groups = mongoose.model("groups");
    return groups;
  } catch (error) {
    let groups = getModelByTenant(dbTenant, "group", GroupSchema);
    return groups;
  }
};

module.exports = GroupModel;
