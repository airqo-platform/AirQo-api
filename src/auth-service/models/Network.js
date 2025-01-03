const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
const validator = require("validator");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- network-model`
);
const { HttpError } = require("@utils/errors");

function validateProfilePicture(net_profile_picture) {
  const urlRegex =
    /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/g;
  if (!urlRegex.test(net_profile_picture)) {
    logger.error(`🙅🙅 Bad Request Error -- Not a valid profile picture URL`);
    return false;
  }
  if (net_profile_picture.length > 200) {
    logText("longer than 200 chars");
    logger.error(
      `🙅🙅 Bad Request Error -- profile picture URL exceeds 200 characters`
    );
    return false;
  }
  return true;
}

const NetworkSchema = new Schema(
  {
    net_email: {
      type: String,
      unique: true,
      required: [true, "net_email is required"],
      trim: true,
      validate: {
        validator(net_email) {
          return validator.isEmail(net_email);
        },
        message: "{VALUE} is not a valid email!",
      },
    },
    net_parent: {
      type: ObjectId,
      ref: "network",
    },
    net_name: {
      type: String,
      required: [true, "net_name is required"],
      unique: true,
    },
    net_status: { type: String, default: "inactive" },
    net_connection_string: {
      type: String,
      required: [true, "net_connection_string is required"],
    },
    net_connection_endpoint: {
      type: String,
      required: [true, "net_connection_endpoint is required"],
    },
    net_username: {
      type: String,
      required: [true, "net_username is required"],
    },
    net_password: { type: String },
    net_specific_fields: {},
    net_manager: { type: ObjectId },
    net_last: { type: Number },
    net_manager_username: { type: String },
    net_manager_firstname: { type: String },
    net_manager_lastname: { type: String },
    has_children: { type: Number },
    net_children: [{ type: ObjectId, ref: "network" }],
    net_data_source: { type: String },
    net_api_key: { type: String },
    net_phoneNumber: {
      type: Number,
      unique: true,
    },
    net_website: {
      type: String,
      unique: true,
    },
    net_description: {
      type: String,
      required: [true, "description is required"],
    },
    net_acronym: {
      type: String,
      required: [true, "net_acronym is required"],
      unique: true,
    },
    net_category: {
      type: String,
    },
    net_departments: [
      {
        type: ObjectId,
        ref: "department",
      },
    ],
    net_permissions: [
      {
        type: ObjectId,
        ref: "permission",
      },
    ],
    net_profile_picture: {
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

NetworkSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

NetworkSchema.index({ net_website: 1 }, { unique: true });
NetworkSchema.index({ net_email: 1 }, { unique: true });
NetworkSchema.index({ net_phoneNumber: 1 }, { unique: true });
NetworkSchema.index({ net_acronym: 1 }, { unique: true });
NetworkSchema.index({ net_name: 1 }, { unique: true });

NetworkSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany", "update", "save"],
  async function (next) {
    const isNew = this.isNew;
    let updates = this.getUpdate ? this.getUpdate() : this;

    try {
      // Get the current document for context
      const query = this.getQuery ? this.getQuery() : { _id: this._id };

      // Get the correct tenant-specific model
      const tenant = this.tenant || constants.DEFAULT_TENANT || "airqo";
      const Network = getModelByTenant(tenant, "network", NetworkSchema);

      const existingDoc = await Network.findOne(query);

      // Helper function to handle array field updates
      const handleArrayFieldUpdates = (fieldName) => {
        if (updates[fieldName]) {
          updates["$addToSet"] = updates["$addToSet"] || {};
          updates["$addToSet"][fieldName] = {
            $each: updates[fieldName],
          };
          delete updates[fieldName];
        }
      };

      // Process array field updates
      handleArrayFieldUpdates("net_departments");
      handleArrayFieldUpdates("net_permissions");

      // Get all actual fields being updated from both root and $set
      const actualUpdates = {
        ...(updates || {}),
        ...(updates.$set || {}),
      };

      // Profile picture validation for both new documents and updates
      if (isNew) {
        // Validation for new documents
        this.net_status = this.net_status || "inactive";
        if (
          this.net_profile_picture &&
          !validateProfilePicture(this.net_profile_picture)
        ) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid profile picture URL",
            })
          );
        }
      } else if (actualUpdates.net_profile_picture) {
        // Validation for updates
        if (!validateProfilePicture(actualUpdates.net_profile_picture)) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid profile picture URL",
            })
          );
        }
      }

      // Unique field handling
      const uniqueFields = [
        "net_email",
        "net_name",
        "net_phoneNumber",
        "net_website",
        "net_acronym",
      ];

      for (const field of uniqueFields) {
        const fieldValue = isNew
          ? this[field]
          : updates[field] || (updates.$set && updates.$set[field]);

        if (fieldValue) {
          const duplicateDoc = await Network.findOne({
            [field]: fieldValue,
          });

          if (
            duplicateDoc &&
            (!existingDoc ||
              duplicateDoc._id.toString() !== existingDoc._id.toString())
          ) {
            return next(
              new HttpError("Duplicate Error", httpStatus.CONFLICT, {
                message: `${field} must be unique`,
              })
            );
          }
        }
      }

      // Limit departments and permissions
      const ORGANISATIONS_LIMIT = 6;
      const checkArrayLimit = (arrayField) => {
        if (this[arrayField] && this[arrayField].length > ORGANISATIONS_LIMIT) {
          return next(
            new HttpError("Validation Error", httpStatus.BAD_REQUEST, {
              message: `Maximum ${ORGANISATIONS_LIMIT} ${arrayField} allowed`,
            })
          );
        }
      };

      checkArrayLimit("net_departments");
      checkArrayLimit("net_permissions");

      return next();
    } catch (error) {
      return next(error);
    }
  }
);

NetworkSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      net_email: this.net_email,
      net_website: this.net_website,
      net_profile_picture: this.net_profile_picture,
      net_category: this.net_category,
      net_status: this.net_status,
      net_phoneNumber: this.net_phoneNumber,
      net_name: this.net_name,
      net_manager: this.net_manager,
      net_departments: this.net_departments,
      net_permissions: this.net_permissions,
      net_roles: this.net_roles,
      net_description: this.net_description,
      net_acronym: this.net_acronym,
      net_createdAt: this.createdAt,
      net_data_source: this.net_data_source,
      net_api_key: this.net_api_key,
      net_connection_string: this.net_connection_string,
      net_connection_endpoint: this.net_connection_endpoint,
      net_username: this.net_username,
      net_password: this.net_password,
      net_specific_fields: this.net_specific_fields,
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
    logger.error(`internal server error -- ${JSON.stringify(error)}`);
    logElement("the sanitise name error", error.message);
  }
};

NetworkSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({
        ...args,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "network created",
          status: httpStatus.OK,
        };
      } else if (isEmpty(data)) {
        return {
          success: true,
          data: [],
          message: "network NOT successfully created but operation successful",
          status: httpStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        Object.entries(err.keyValue).forEach(([key, value]) => {
          logObject("err.keyValue", err.keyValue);
          response[key] = value;
          response["message"] = "duplicate values provided";
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        logObject("err.errors", err.errors);
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] =
            "input validation errors for some of the provided fields";
          return response;
        });
      }

      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.NETWORKS_INCLUSION_PROJECTION;
      const exclusionProjection = constants.NETWORKS_EXCLUSION_PROJECTION(
        filter.category ? filter.category : "none"
      );
      logObject("inclusionProjection", inclusionProjection);
      logObject("exclusionProjection", exclusionProjection);

      if (!isEmpty(filter.category)) {
        delete filter.category;
      }
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          let: { users: { $ifNull: ["$networks", []] } },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", "$$users"] },
              },
            },
            {
              $lookup: {
                from: "roles",
                localField: "role",
                foreignField: "_id",
                as: "role",
              },
            },
            {
              $addFields: {
                role: { $arrayElemAt: ["$role", 0] },
                createdAt: {
                  $dateToString: {
                    format: "%Y-%m-%d %H:%M:%S",
                    date: "$_id",
                  },
                },
              },
            },
            {
              $project: {
                "role.role_status": 0,
                "role.role_permissions": 0,
                "role.role_users": 0,
                "role.role_code": 0,
                "role.network_id": 0,
                "role.__v": 0,
              },
            },
          ],
          as: "net_users",
        })
        .lookup({
          from: "permissions",
          localField: "net_permissions",
          foreignField: "_id",
          as: "net_permissions",
        })
        .lookup({
          from: "roles",
          localField: "_id",
          foreignField: "network_id",
          as: "net_roles",
        })
        .lookup({
          from: "departments",
          localField: "net_departments",
          foreignField: "_id",
          as: "net_departments",
        })
        .lookup({
          from: "users",
          localField: "net_manager",
          foreignField: "_id",
          as: "net_manager",
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
          message: "successfully retrieved the network details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message:
            "No network details exist for this operation, please crosscheck",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (err) {
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      logObject("error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }

      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      next(new HttpError(message, status, response));
    }
  },
  async oldModify({ filter = {}, update = {} } = {}, next) {
    try {
      let options = { new: true };
      let modifiedUpdate = Object.assign({}, update);

      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      if (modifiedUpdate.net_departments) {
        modifiedUpdate["$addToSet"] = {};
        modifiedUpdate["$addToSet"]["net_departments"] = {};
        modifiedUpdate["$addToSet"]["net_departments"]["$each"] =
          modifiedUpdate.net_departments;
        delete modifiedUpdate["net_departments"];
      }

      if (modifiedUpdate.net_permissions) {
        modifiedUpdate["$addToSet"] = {};
        modifiedUpdate["$addToSet"]["net_permissions"] = {};
        modifiedUpdate["$addToSet"]["net_permissions"]["$each"] =
          modifiedUpdate.net_permissions;
        delete modifiedUpdate["net_permissions"];
      }

      if (modifiedUpdate.net_roles) {
        modifiedUpdate["$addToSet"] = {};
        modifiedUpdate["$addToSet"]["net_roles"] = {};
        modifiedUpdate["$addToSet"]["net_roles"]["$each"] =
          modifiedUpdate.net_roles;
        delete modifiedUpdate["net_roles"];
      }

      logObject("modifiedUpdate", modifiedUpdate);
      logObject("filter", filter);

      const updatedNetwork = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      logObject("updatedNetwork", updatedNetwork);

      if (!isEmpty(updatedNetwork)) {
        return {
          success: true,
          message: "successfully modified the network",
          data: updatedNetwork._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedNetwork)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No networks exist for this operation",
          })
        );
      }
    } catch (err) {
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.code) &&
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      } else if (
        !isEmpty(err.code) &&
        !isEmpty(err.codeName) &&
        (err.code === 13 || err.codeName === "Unauthorized")
      ) {
        response["message"] = "Unauthorized to carry out this operation";
      }
      next(new HttpError(message, status, response));
    }
  },
  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const options = { new: true };

      const updatedNetwork = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!updatedNetwork) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No networks exist for this operation",
          })
        );
      }

      return {
        success: true,
        message: "successfully modified the network",
        data: updatedNetwork._doc,
        status: httpStatus.OK,
      };
    } catch (err) {
      logger.error(`internal server error -- ${JSON.stringify(err)}`);

      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;

      if (
        !isEmpty(err.code) &&
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
        });
      } else if (
        !isEmpty(err.code) &&
        !isEmpty(err.codeName) &&
        (err.code === 13 || err.codeName === "Unauthorized")
      ) {
        response["message"] = "Unauthorized to carry out this operation";
      }

      return next(new HttpError(message, status, response));
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: {
          _id: 1,
          net_email: 1,
          net_website: 1,
          net_name: 1,
          net_manager: 1,
        },
      };
      logObject("the FILTER we are using", filter);
      const removedNetwork = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedNetwork)) {
        return {
          success: true,
          message: "successfully removed the network",
          data: removedNetwork._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedNetwork)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Network does not exist for this operation",
          })
        );
      }
    } catch (err) {
      logger.error(`internal server error -- ${JSON.stringify(err)}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (
        !isEmpty(err.code) &&
        !isEmpty(err.keyValue) &&
        (err.code === 11000 || err.code === 11001)
      ) {
        message = "duplicate values provided";
        status = httpStatus.CONFLICT;
        Object.entries(err.keyValue).forEach(([key, value]) => {
          response[key] = value;
          response["message"] = value;
          return response;
        });
      } else if (!isEmpty(err.errors)) {
        Object.entries(err.errors).forEach(([key, value]) => {
          response[key] = value.message;
          response["message"] = value.message;
          return response;
        });
      }
      next(new HttpError(message, status, response));
    }
  },
};

const NetworkModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(dbTenant, "network", NetworkSchema);
    return networks;
  }
};

module.exports = NetworkModel;
