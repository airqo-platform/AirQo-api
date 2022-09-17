const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { Schema } = mongoose;
const validator = require("validator");
var uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("../utils/log");
const isEmpty = require("is-empty");
const createOrganizationUtil = require("../utils/create-organization");
const { getModelByTenant } = require("../utils/multitenancy");
const HTTPStatus = require("http-status");

const OrganizationSchema = new Schema(
  {
    email: {
      type: String,
      unique: true,
      required: [true, "Email is required"],
      trim: true,
      validate: {
        validator(email) {
          return validator.isEmail(email);
        },
        message: "{VALUE} is not a valid email!",
      },
    },
    status: { type: String, default: "inactive" },
    isActive: { type: Boolean, default: false },
    isAlias: { type: Boolean },
    phoneNumber: {
      type: Number,
      unique: true,
      required: [true, "phoneNumber is required"],
    },
    website: {
      type: String,
      unique: true,
      required: [true, "the website is required"],
    },
    name: { type: String, required: [true, "name is required"] },
    tenant: {
      type: String,
      required: [true, "tenant is required"],
    },
    acronym: {
      type: String,
      required: [true, "acronym is required"],
      unique: true,
    },
    category: {
      type: String,
      required: [true, "category is required"],
    },
    users: [
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

OrganizationSchema.plugin(uniqueValidator, {
  message: `{VALUE} should be unique!`,
});

OrganizationSchema.index({ website: 1 }, { unique: true });
OrganizationSchema.index({ email: 1 }, { unique: true });
OrganizationSchema.index({ phoneNumber: 1 }, { unique: true });
OrganizationSchema.index({ acronym: 1 }, { unique: true });

OrganizationSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      email: this.email,
      website: this.website,
      category: this.category,
      status: this.status,
      isAlias: this.isAlias,
      isActive: this.isActive,
      phoneNumber: this.phoneNumber,
      tenant: this.tenant,
      users: this.users,
      name: this.name,
      acronym: this.acronym,
      createdAt: this.createdAt,
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

OrganizationSchema.statics = {
  async register(args) {
    try {
      let modifiedArgs = args;
      let tenant = modifiedArgs.tenant;
      if (tenant) {
        modifiedArgs["tenant"] = sanitizeName(tenant);
      }
      let data = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(data)) {
        return {
          success: true,
          data,
          message: "organization created",
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: true,
          data,
          message:
            "organization NOT successfully created but operation successful",
          status: HTTPStatus.NO_CONTENT,
        };
      }
    } catch (err) {
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
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
  async list({ skip = 0, limit = 5, filter = {} } = {}) {
    try {
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "users",
          localField: "_id",
          foreignField: "organizations",
          as: "users",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          email: 1,
          website: 1,
          category: 1,
          status: 1,
          isAlias: 1,
          isActive: 1,
          phoneNumber: 1,
          tenant: 1,
          name: 1,
          acronym: 1,
          createdAt: 1,
          users: "$users",
        })
        .project({
          "users.__v": 0,
          "users.notifications": 0,
          "users.emailConfirmed": 0,
          "users.organizations": 0,
          "users.locationCount": 0,
          "users.organization": 0,
          "users.long_organization": 0,
          "users.privilege": 0,
          "users.userName": 0,
          "users.password": 0,
          "users.duration": 0,
          "users.createdAt": 0,
          "users.updatedAt": 0,
        })
        .skip(skip ? skip : 0)
        .limit(limit ? limit : 100)
        .allowDiskUse(true);

      if (!isEmpty(response)) {
        let data = response;
        return {
          success: true,
          message: "successfully retrieved the organizations",
          data,
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: false,
          message: "organization/s do not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          data: [],
          errors: { message: "unable to retrieve organizations" },
        };
      }
    } catch (err) {
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
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
      let modifiedUpdate = update;
      modifiedUpdate["$addToSet"] = {};
      if (modifiedUpdate.tenant) {
        delete modifiedUpdate.tenant;
      }

      if (modifiedUpdate.users) {
        modifiedUpdate["$addToSet"]["users"] = {};
        modifiedUpdate["$addToSet"]["users"]["$each"] = modifiedUpdate.users;
        delete modifiedUpdate["users"];
      }

      let updatedOrganization = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedOrganization)) {
        let data = updatedOrganization._doc;
        return {
          success: true,
          message: "successfully modified the organization",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "organization does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: "Not Found",
        };
      }
    } catch (err) {
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
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
          email: 1,
          website: 1,
          tenant: 1,
          name: 1,
          isActive: 1,
          isAlias: 1,
        },
      };
      let removedOrganization = await this.findOneAndRemove(
        filter,
        options
      ).exec();

      if (!isEmpty(removedOrganization)) {
        let data = removedOrganization._doc;
        return {
          success: true,
          message: "successfully removed the organization",
          data,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "organization does not exist, please crosscheck",
          status: HTTPStatus.NOT_FOUND,
          errors: "Not Found",
        };
      }
    } catch (err) {
      let response = {};
      let errors = {};
      let message = "Internal Server Error";
      let status = HTTPStatus.INTERNAL_SERVER_ERROR;
      if (err.code === 11000 || err.code === 11001) {
        errors = err.keyValue;
        message = "duplicate values provided";
        status = HTTPStatus.CONFLICT;
        Object.entries(errors).forEach(([key, value]) => {
          return (response[key] = value);
        });
      } else {
        message = "validation errors for some of the provided fields";
        status = HTTPStatus.CONFLICT;
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

module.exports = OrganizationSchema;
